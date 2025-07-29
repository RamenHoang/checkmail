const express = require('express');
const Database = require('../database/database');

const router = express.Router();
const db = new Database();

// Initialize database connection
db.init().catch(console.error);

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

module.exports = router;
