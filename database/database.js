const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
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
              console.error('Error creating table:', createErr);
              reject(createErr);
            } else {
              console.log('✅ Database tables created successfully');
              resolve();
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
