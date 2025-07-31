const express = require('express');
const Database = require('../database/database');
const XLSX = require('xlsx');

// Export a function that takes the auth middleware and upload middleware
module.exports = function(requireAuth, upload) {
  const router = express.Router();
  const db = new Database();

  // Initialize database connection
  db.init().catch(console.error);

  // Admin login page (no auth required)
  router.get('/login', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
      return res.redirect('/admin');
    }
    res.render('admin/login', { 
      title: 'Admin Login',
      error: null 
    });
  });

  // Handle login
  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
      const user = await db.authenticateAdmin(username, password);
      
      if (user) {
        req.session.isAuthenticated = true;
        req.session.username = user.username;
        req.session.userId = user.id;
        res.redirect('/admin');
      } else {
        res.render('admin/login', { 
          title: 'Admin Login',
          error: 'Tên đăng nhập hoặc mật khẩu không đúng' 
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      res.render('admin/login', { 
        title: 'Admin Login',
        error: 'Có lỗi xảy ra trong quá trình đăng nhập' 
      });
    }
  });

  // Handle logout
  router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      res.redirect('/');
    });
  });

  // Protect all other admin routes
  router.use(requireAuth);

  // Admin dashboard
  router.get('/', async (req, res) => {
    try {
      const [emails, stats] = await Promise.all([
        db.getAllEmails(),
        db.getStats()
      ]);

      res.render('admin/index', { 
        title: 'Admin Dashboard',
        emails: emails,
        stats: stats,
        message: null
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
      res.render('admin/index', { 
        title: 'Admin Dashboard',
        emails: [],
        stats: { total: 0, available: 0, used: 0 },
        message: 'Có lỗi xảy ra khi tải dữ liệu'
      });
    }
  });

  // API endpoint to fetch emails and stats (for AJAX refresh)
  router.get('/api/emails', async (req, res) => {
    try {
      const [emails, stats] = await Promise.all([
        db.getAllEmails(),
        db.getStats()
      ]);

      res.json({
        success: true,
        emails: emails,
        stats: stats
      });
    } catch (error) {
      console.error('Error fetching emails via API:', error);
      res.status(500).json({
        success: false,
        message: 'Có lỗi xảy ra khi tải dữ liệu',
        emails: [],
        stats: { total: 0, available: 0, used: 0 }
      });
    }
  });

  // Add new email
  router.post('/add', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.json({ success: false, message: 'Email không hợp lệ' });
      }

      await db.addEmail(email.trim());
      res.json({ success: true, message: 'Email đã được thêm thành công' });
    } catch (error) {
      console.error('Error adding email:', error);
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.json({ success: false, message: 'Email đã tồn tại trong hệ thống' });
      } else {
        res.json({ success: false, message: 'Có lỗi xảy ra khi thêm email' });
      }
    }
  });

  // Delete email
  router.post('/delete', async (req, res) => {
    try {
      const { id } = req.body;
      
      if (!id) {
        return res.json({ success: false, message: 'ID email không hợp lệ' });
      }

      const success = await db.deleteEmail(id);
      
      if (success) {
        res.json({ success: true, message: 'Email đã được xóa thành công' });
      } else {
        res.json({ success: false, message: 'Không tìm thấy email để xóa' });
      }
    } catch (error) {
      console.error('Error deleting email:', error);
      res.json({ success: false, message: 'Có lỗi xảy ra khi xóa email' });
    }
  });

  // Reset email status
  router.post('/reset', async (req, res) => {
    try {
      const { id } = req.body;
      
      if (!id) {
        return res.json({ success: false, message: 'ID email không hợp lệ' });
      }

      const success = await db.resetEmailStatus(id);
      
      if (success) {
        res.json({ success: true, message: 'Trạng thái email đã được reset' });
      } else {
        res.json({ success: false, message: 'Không tìm thấy email để reset' });
      }
    } catch (error) {
      console.error('Error resetting email:', error);
      res.json({ success: false, message: 'Có lỗi xảy ra khi reset email' });
    }
  });

  // Admin settings page
  router.get('/settings', (req, res) => {
    res.render('admin/settings', { 
      title: 'Admin Settings',
      currentUsername: req.session.username,
      message: null,
      error: null
    });
  });

  // Change admin credentials
  router.post('/change-credentials', async (req, res) => {
    const { currentPassword, newUsername, newPassword, confirmPassword } = req.body;
    
    try {
      // Validate input
      if (!currentPassword || !newUsername || !newPassword || !confirmPassword) {
        return res.render('admin/settings', {
          title: 'Admin Settings',
          currentUsername: req.session.username,
          error: 'Vui lòng điền đầy đủ thông tin',
          message: null
        });
      }

      if (newPassword !== confirmPassword) {
        return res.render('admin/settings', {
          title: 'Admin Settings',
          currentUsername: req.session.username,
          error: 'Mật khẩu mới và xác nhận mật khẩu không khớp',
          message: null
        });
      }

      if (newPassword.length < 6) {
        return res.render('admin/settings', {
          title: 'Admin Settings',
          currentUsername: req.session.username,
          error: 'Mật khẩu mới phải có ít nhất 6 ký tự',
          message: null
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await db.authenticateAdmin(req.session.username, currentPassword);
      if (!isCurrentPasswordValid) {
        return res.render('admin/settings', {
          title: 'Admin Settings',
          currentUsername: req.session.username,
          error: 'Mật khẩu hiện tại không đúng',
          message: null
        });
      }

      // Update credentials
      const success = await db.changeAdminCredentials(req.session.username, newUsername, newPassword);
      
      if (success) {
        // Update session with new username
        req.session.username = newUsername;
        
        res.render('admin/settings', {
          title: 'Admin Settings',
          currentUsername: newUsername,
          message: 'Thông tin đăng nhập đã được cập nhật thành công!',
          error: null
        });
      } else {
        res.render('admin/settings', {
          title: 'Admin Settings',
          currentUsername: req.session.username,
          error: 'Có lỗi xảy ra khi cập nhật thông tin',
          message: null
        });
      }
    } catch (error) {
      console.error('Error changing credentials:', error);
      res.render('admin/settings', {
        title: 'Admin Settings',
        currentUsername: req.session.username,
        error: 'Có lỗi xảy ra khi cập nhật thông tin: ' + error.message,
        message: null
      });
    }
  });

  // Export copied emails to Excel
  router.get('/export-copied-emails', async (req, res) => {
    try {
      const copiedEmails = await db.getCopiedEmails();
      
      if (copiedEmails.length === 0) {
        return res.json({ success: false, message: 'Không có email nào đã được copy để xuất' });
      }

      // Prepare data for Excel
      const excelData = copiedEmails.map((email, index) => ({
        'STT': index + 1,
        'Email': email.email,
        'Thời gian copy': email.copied_at ? new Date(email.copied_at).toLocaleString('vi-VN') : 'N/A',
        'IP Address': email.copied_ip || 'N/A',
        'Ngày tạo email': email.created_at ? new Date(email.created_at).toLocaleString('vi-VN') : 'N/A'
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 5 },   // STT
        { wch: 30 },  // Email
        { wch: 20 },  // Thời gian copy
        { wch: 15 },  // IP Address
        { wch: 20 }   // Ngày tạo email
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Copied Emails');

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set response headers for file download
      const filename = `copied-emails-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Length', buffer.length);

      // Send the file
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting copied emails:', error);
      res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi xuất file Excel' });
    }
  });

  // Download sample template for batch import
  router.get('/sample-template', requireAuth, async (req, res) => {
    try {
      // Create sample data
      const sampleData = [
        { 'Email': 'example1@domain.com' },
        { 'Email': 'example2@domain.com' },
        { 'Email': 'example3@domain.com' },
        { 'Email': 'user@example.org' },
        { 'Email': 'test@sample.net' }
      ];

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(sampleData);

      // Set column width
      worksheet['!cols'] = [{ wch: 30 }]; // Email column width

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Email Template');

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set response headers for file download
      const filename = `email-import-template.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Length', buffer.length);

      // Send the file
      res.send(buffer);
    } catch (error) {
      console.error('Error generating sample template:', error);
      res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi tạo file mẫu' });
    }
  });

  // Import emails from Excel file
  router.post('/import', requireAuth, upload.single('emailFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn file Excel để import' });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!data.length) {
        return res.status(400).json({ success: false, message: 'File Excel không có dữ liệu' });
      }

      // Extract emails from the data
      const emails = [];
      const errors = [];

      data.forEach((row, index) => {
        const rowNumber = index + 2; // Excel rows start at 2 (after header)
        
        // Look for email in various possible column names
        const email = row['Email'] || row['email'] || row['EMAIL'] || 
                     row['E-mail'] || row['e-mail'] || row['E-MAIL'];

        if (!email) {
          errors.push(`Dòng ${rowNumber}: Không tìm thấy email`);
        } else if (typeof email === 'string' && email.trim()) {
          emails.push(email.trim());
        } else {
          errors.push(`Dòng ${rowNumber}: Email không hợp lệ`);
        }
      });

      if (emails.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Không tìm thấy email hợp lệ nào trong file',
          errors: errors
        });
      }

      // Import emails using batch import
      const result = await db.batchImportEmails(emails);

      console.log('Import result:', result);

      // Ensure result has the expected structure
      const safeResult = {
        successful: result.results.success || 0,
        failed: result.results.failed || 0,
        duplicates: result.results.duplicates || 0,
        errors: result.results.errors || []
      };

      // Prepare response
      const response = {
        success: true,
        message: `Import thành công ${safeResult.successful} email${safeResult.successful > 1 ? 's' : ''}`,
        details: {
          total: emails.length,
          successful: safeResult.successful,
          failed: safeResult.failed,
          duplicates: safeResult.duplicates,
          errors: safeResult.errors.length
        }
      };

      // Add details about errors if any
      if (safeResult.errors.length > 0) {
        response.importErrors = safeResult.errors.slice(0, 10); // Show first 10 errors
        if (safeResult.errors.length > 10) {
          response.message += ` (${safeResult.errors.length - 10} lỗi khác...)`;
        }
      }

      // Add file parsing errors if any
      if (errors.length > 0) {
        response.fileErrors = errors.slice(0, 10);
      }

      res.json(response);

    } catch (error) {
      console.error('Error importing emails:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Có lỗi xảy ra khi import email', 
        error: error.message 
      });
    }
  });

  return router;
};
