const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, 'emails.db');
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('📁 Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      // First check if the table exists and what its schema looks like
      const checkSql = `SELECT sql FROM sqlite_master WHERE type='table' AND name='emails'`;
      
      this.db.get(checkSql, async (err, row) => {
        if (err) {
          console.error('Error checking table schema:', err);
          reject(err);
          return;
        }

        const needsMigration = row && row.sql && row.sql.includes('INTEGER PRIMARY KEY AUTOINCREMENT');
        
        if (needsMigration) {
          console.log('📋 Migrating database from integer IDs to UUIDs...');
          try {
            await this.migrateToUUID();
            console.log('✅ Database migration completed successfully');
            resolve();
          } catch (migrationErr) {
            console.error('❌ Database migration failed:', migrationErr);
            reject(migrationErr);
          }
        } else {
          // Create new table with UUID schema
          const sql = `
            CREATE TABLE IF NOT EXISTS emails (
              id TEXT PRIMARY KEY,
              email TEXT UNIQUE NOT NULL,
              status TEXT DEFAULT 'available' CHECK(status IN ('available', 'used')),
              copied_at DATETIME NULL,
              copied_ip TEXT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `;

          this.db.run(sql, (createErr) => {
            if (createErr) {
              console.error('Error creating emails table:', createErr);
              reject(createErr);
            } else {
              // Create admin table
              const adminSql = `
                CREATE TABLE IF NOT EXISTS admin_users (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  password_hash TEXT NOT NULL,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
              `;
              
              this.db.run(adminSql, async (adminErr) => {
                if (adminErr) {
                  console.error('Error creating admin table:', adminErr);
                  reject(adminErr);
                } else {
                  // Initialize default admin user if not exists
                  await this.initializeDefaultAdmin();
                  console.log('✅ Database tables created successfully');
                  resolve();
                }
              });
            }
          });
        }
      });
    });
  }

  // Migration method to convert from integer IDs to UUIDs
  async migrateToUUID() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Start transaction
        this.db.run('BEGIN TRANSACTION');

        // Create new table with UUID schema
        const createNewTableSql = `
          CREATE TABLE emails_new (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'available' CHECK(status IN ('available', 'used')),
            copied_at DATETIME NULL,
            copied_ip TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `;

        this.db.run(createNewTableSql, (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
            return;
          }

          // Copy data from old table to new table with new UUIDs
          const selectSql = 'SELECT email, status, copied_at, copied_ip, created_at, updated_at FROM emails';
          
          this.db.all(selectSql, (selectErr, rows) => {
            if (selectErr) {
              this.db.run('ROLLBACK');
              reject(selectErr);
              return;
            }

            if (rows && rows.length > 0) {
              const insertSql = `
                INSERT INTO emails_new (id, email, status, copied_at, copied_ip, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `;

              let completed = 0;
              const total = rows.length;

              rows.forEach((row) => {
                const newId = crypto.randomUUID();
                
                this.db.run(insertSql, [
                  newId,
                  row.email,
                  row.status,
                  row.copied_at,
                  row.copied_ip,
                  row.created_at,
                  row.updated_at
                ], (insertErr) => {
                  if (insertErr) {
                    this.db.run('ROLLBACK');
                    reject(insertErr);
                    return;
                  }

                  completed++;
                  if (completed === total) {
                    // Drop old table and rename new table
                    this.db.run('DROP TABLE emails', (dropErr) => {
                      if (dropErr) {
                        this.db.run('ROLLBACK');
                        reject(dropErr);
                        return;
                      }

                      this.db.run('ALTER TABLE emails_new RENAME TO emails', (renameErr) => {
                        if (renameErr) {
                          this.db.run('ROLLBACK');
                          reject(renameErr);
                          return;
                        }

                        this.db.run('COMMIT', (commitErr) => {
                          if (commitErr) {
                            reject(commitErr);
                          } else {
                            console.log(`✅ Migrated ${total} emails to UUID format`);
                            resolve();
                          }
                        });
                      });
                    });
                  }
                });
              });
            } else {
              // No data to migrate, just replace the table
              this.db.run('DROP TABLE emails', (dropErr) => {
                if (dropErr) {
                  this.db.run('ROLLBACK');
                  reject(dropErr);
                  return;
                }

                this.db.run('ALTER TABLE emails_new RENAME TO emails', (renameErr) => {
                  if (renameErr) {
                    this.db.run('ROLLBACK');
                    reject(renameErr);
                    return;
                  }

                  this.db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      console.log('✅ Empty table migrated to UUID format');
                      resolve();
                    }
                  });
                });
              });
            }
          });
        });
      });
    });
  }

  // Get one available email for user
  async getAvailableEmail() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM emails WHERE status = 'available' ORDER BY RANDOM() LIMIT 1`;
      
      this.db.get(sql, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Get email by ID
  async getEmailById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM emails WHERE id = ?`;
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Mark email as used
  async markEmailAsUsed(id, ip) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE emails 
        SET status = 'used', 
            copied_at = CURRENT_TIMESTAMP, 
            copied_ip = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'available'
      `;
      
      this.db.run(sql, [ip, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Get all emails for admin
  async getAllEmails() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM emails 
        ORDER BY 
          CASE WHEN status = 'available' THEN 0 ELSE 1 END,
          created_at DESC
      `;
      
      this.db.all(sql, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Add new email
  async addEmail(email) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const sql = `INSERT INTO emails (id, email) VALUES (?, ?)`;
      
      this.db.run(sql, [id, email], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  // Delete email
  async deleteEmail(id) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM emails WHERE id = ?`;
      
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Reset email status
  async resetEmailStatus(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE emails 
        SET status = 'available', 
            copied_at = NULL, 
            copied_ip = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  // Get statistics
  async getStats() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
          SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used
        FROM emails
      `;
      
      this.db.get(sql, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Initialize default admin user
  async initializeDefaultAdmin() {
    return new Promise((resolve, reject) => {
      // Check if any admin user exists
      this.db.get('SELECT COUNT(*) as count FROM admin_users', [], async (err, row) => {
        if (err) {
          console.error('Error checking admin users:', err);
          reject(err);
          return;
        }

        if (row.count === 0) {
          // Create default admin user
          const defaultPassword = 'admin123';
          const saltRounds = 10;
          
          try {
            const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);
            
            this.db.run(
              'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
              ['admin', passwordHash],
              (insertErr) => {
                if (insertErr) {
                  console.error('Error creating default admin:', insertErr);
                  reject(insertErr);
                } else {
                  console.log('✅ Default admin user created (admin/admin123)');
                  resolve();
                }
              }
            );
          } catch (hashErr) {
            console.error('Error hashing password:', hashErr);
            reject(hashErr);
          }
        } else {
          resolve();
        }
      });
    });
  }

  // Admin authentication methods
  async authenticateAdmin(username, password) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, username, password_hash FROM admin_users WHERE username = ?',
        [username],
        async (err, row) => {
          if (err) {
            console.error('Database error during authentication:', err);
            reject(err);
            return;
          }

          if (!row) {
            resolve(false); // User not found
            return;
          }

          try {
            const isValid = await bcrypt.compare(password, row.password_hash);
            resolve(isValid ? { id: row.id, username: row.username } : false);
          } catch (compareErr) {
            console.error('Error comparing passwords:', compareErr);
            reject(compareErr);
          }
        }
      );
    });
  }

  // Change admin credentials
  async changeAdminCredentials(currentUsername, newUsername, newPassword) {
    return new Promise((resolve, reject) => {
      const saltRounds = 10;
      
      bcrypt.hash(newPassword, saltRounds, (hashErr, passwordHash) => {
        if (hashErr) {
          console.error('Error hashing new password:', hashErr);
          reject(hashErr);
          return;
        }

        this.db.run(
          `UPDATE admin_users 
           SET username = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE username = ?`,
          [newUsername, passwordHash, currentUsername],
          function(updateErr) {
            if (updateErr) {
              console.error('Error updating admin credentials:', updateErr);
              reject(updateErr);
            } else if (this.changes === 0) {
              resolve(false); // No rows updated
            } else {
              console.log('✅ Admin credentials updated successfully');
              resolve(true);
            }
          }
        );
      });
    });
  }

  // Add admin user for seeding
  async addAdminUser(username, password) {
    return new Promise((resolve, reject) => {
      const saltRounds = 10;
      
      bcrypt.hash(password, saltRounds, (hashErr, passwordHash) => {
        if (hashErr) {
          console.error('Error hashing password for admin user:', hashErr);
          reject(hashErr);
          return;
        }

        this.db.run(
          'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
          [username, passwordHash],
          function(insertErr) {
            if (insertErr) {
              reject(insertErr);
            } else {
              resolve(this.lastID);
            }
          }
        );
      });
    });
  }

  // Get copied emails for export
  async getCopiedEmails() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          email,
          copied_at,
          copied_ip,
          created_at
        FROM emails 
        WHERE status = 'used' AND copied_at IS NOT NULL
        ORDER BY copied_at DESC
      `;
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('Error fetching copied emails:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Batch import emails from array
  async batchImportEmails(emailArray) {
    const results = {
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: []
    };

    return new Promise(async (resolve, reject) => {
      try {
        // Start transaction
        this.db.run('BEGIN TRANSACTION');

        for (let i = 0; i < emailArray.length; i++) {
          const email = emailArray[i];
          
          try {
            // Basic email validation
            if (!email || typeof email !== 'string') {
              results.failed++;
              results.errors.push(`Row ${i + 1}: Email không đúng định dạng - ${email}`);
              continue;
            }

            const emailTrimmed = email.trim().toLowerCase();
            
            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailTrimmed)) {
              results.failed++;
              results.errors.push(`Row ${i + 1}: Email không đúng định dạng - ${email}`);
              continue;
            }

            // Check if email already exists
            const existingEmail = await new Promise((resolve, reject) => {
              this.db.get('SELECT id FROM emails WHERE email = ?', [emailTrimmed], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            if (existingEmail) {
              results.duplicates++;
              results.errors.push(`Row ${i + 1}: Email đã tồn tại - ${email}`);
              continue;
            }

            // Generate UUID and extract domain
            const emailId = this.generateUUID();

            // Insert email
            await new Promise((resolve, reject) => {
              this.db.run(`
                INSERT INTO emails (id, email, status)
                VALUES (?, ?, 'available')
              `, [emailId, emailTrimmed], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              });
            });

            results.success++;
          } catch (error) {
            results.failed++;
            results.errors.push(`Row ${i + 1}: ${error.message} - ${email}`);
          }
        }

        // Commit transaction
        this.db.run('COMMIT', (err) => {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
          } else {
            resolve({
              success: true,
              results: results
            });
          }
        });
      } catch (error) {
        // Rollback transaction on error
        this.db.run('ROLLBACK');
        console.error('Batch import error:', error);
        resolve({
          success: false,
          error: error.message,
          results: results
        });
      }
    });
  }

  // Generate UUID for email IDs
  generateUUID() {
    return crypto.randomUUID();
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('📁 Database connection closed');
        }
      });
    }
  }
}

module.exports = Database;
