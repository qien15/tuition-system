/**
 * server.js
 * 补习中心综合管理系统 (Tuition Centre Management System) 后端服务器
 * 技术栈: Node.js + Express + MySQL (mysql2 Prepared Statements)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { queryPrepared, withTransaction } = require('./db_config');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * 辅助函数：生成标准收据单号 (RCP-YYYYMMDD-XXXX)
 * @param {number} paymentId 缴费记录ID
 * @returns {string}
 */
function generateReceiptNo(paymentId) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const padId = String(paymentId).padStart(4, '0');
  return `RCP-${dateStr}-${padId}`;
}

/**
 * 辅助函数：格式化金额为 DECIMAL(10,2) 对应 float
 * @param {number|string} val 
 * @returns {string}
 */
function formatAmount(val) {
  const num = parseFloat(val);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

// ============================================================
// 1. 仪表盘统计 API (Dashboard Statistics)
// ============================================================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const studentRows = await queryPrepared(
      'SELECT COUNT(*) AS totalStudents FROM students WHERE status = ?',
      ['Active']
    );
    const classRows = await queryPrepared(
      'SELECT COUNT(*) AS totalClasses FROM classes',
      []
    );
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const paidRows = await queryPrepared(
      'SELECT SUM(amount) AS totalPaidAmount FROM payments WHERE month_year = ? AND status = ?',
      [currentMonth, 'Paid']
    );
    
    const unpaidRows = await queryPrepared(
      'SELECT COUNT(*) AS unpaidCount FROM payments WHERE month_year = ? AND status IN (?, ?)',
      [currentMonth, 'Unpaid', 'Overdue']
    );

    const totalStudents = studentRows[0] ? studentRows[0].totalStudents : 0;
    const totalClasses = classRows[0] ? classRows[0].totalClasses : 0;
    const totalPaidAmount = paidRows[0] && paidRows[0].totalPaidAmount !== null 
      ? formatAmount(paidRows[0].totalPaidAmount) 
      : '0.00';
    const unpaidCount = unpaidRows[0] ? unpaidRows[0].unpaidCount : 0;

    res.json({
      success: true,
      data: {
        totalStudents,
        totalClasses,
        totalPaidAmount,
        unpaidCount,
        currentMonth
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ success: false, message: '获取仪表盘数据失败', error: err.message });
  }
});

// ============================================================
// 2. 学生管理 API (Student API)
// ============================================================

// 2.1 获取学生列表 (支持筛选与搜索)
app.get('/api/students', async (req, res) => {
  try {
    const { keyword, grade, status, subject } = req.query;
    let sql = `
      SELECT s.student_id, s.student_code, s.name, s.gender, s.phone,
             s.parent_name, s.parent_phone, s.grade, s.enrolled_subjects, s.base_fee, s.status, s.created_at
      FROM students s
      WHERE 1=1
    `;
    const params = [];

    if (keyword) {
      sql += ` AND (s.name LIKE ? OR s.student_code LIKE ? OR s.phone LIKE ? OR s.parent_phone LIKE ?)`;
      const term = `%${keyword}%`;
      params.push(term, term, term, term);
    }
    if (grade) {
      sql += ` AND s.grade = ?`;
      params.push(grade);
    }
    if (status) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }
    if (subject) {
      sql += ` AND s.enrolled_subjects LIKE ?`;
      params.push(`%${subject}%`);
    }

    sql += ` ORDER BY s.student_id DESC`;

    const students = await queryPrepared(sql, params);
    const formattedStudents = students.map(s => ({
      ...s,
      base_fee: formatAmount(s.base_fee || 0.00)
    }));
    res.json({ success: true, data: formattedStudents });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ success: false, message: '获取学生列表失败', error: err.message });
  }
});

// 2.2 新增学生
app.post('/api/students', async (req, res) => {
  try {
    const { student_code, name, gender, phone, parent_name, parent_phone, grade, enrolled_subjects, base_fee } = req.body;

    if (!name || !parent_phone || !grade) {
      return res.status(400).json({ success: false, message: '学生姓名、家长电话和年级为必填项' });
    }

    // 自动生成学号 (若前端未传)
    const finalCode = student_code || `STU${Date.now().toString().slice(-7)}`;
    const finalSubjects = Array.isArray(enrolled_subjects) ? enrolled_subjects.join(', ') : (enrolled_subjects || '');
    const finalFee = formatAmount(base_fee || 0);

    const sql = `
      INSERT INTO students (student_code, name, gender, phone, parent_name, parent_phone, grade, enrolled_subjects, base_fee, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `;
    const params = [finalCode, name, gender || 'Male', phone || '', parent_name || '', parent_phone, grade, finalSubjects, finalFee];

    const result = await queryPrepared(sql, params);
    res.json({
      success: true,
      message: '添加学生成功',
      data: { student_id: result.insertId, student_code: finalCode, enrolled_subjects: finalSubjects, base_fee: finalFee }
    });
  } catch (err) {
    console.error('Error creating student:', err);
    res.status(500).json({ success: false, message: '添加学生失败', error: err.message });
  }
});

// 2.3 更新学生信息
app.put('/api/students/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    const { name, gender, phone, parent_name, parent_phone, grade, enrolled_subjects, base_fee, status } = req.body;
    const finalSubjects = Array.isArray(enrolled_subjects) ? enrolled_subjects.join(', ') : (enrolled_subjects || '');
    const finalFee = formatAmount(base_fee || 0);

    const sql = `
      UPDATE students 
      SET name = ?, gender = ?, phone = ?, parent_name = ?, parent_phone = ?, grade = ?, enrolled_subjects = ?, base_fee = ?, status = ?
      WHERE student_id = ?
    `;
    const params = [name, gender, phone, parent_name, parent_phone, grade, finalSubjects, finalFee, status, studentId];

    await queryPrepared(sql, params);
    res.json({ success: true, message: '更新学生信息成功' });
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ success: false, message: '更新学生信息失败', error: err.message });
  }
});

// ============================================================
// 3. 班级与课程 API (Classes API)
// ============================================================
app.get('/api/classes', async (req, res) => {
  try {
    const sql = `
      SELECT c.class_id, c.class_name, c.subject, c.grade, c.teacher_name, 
             c.fee_amount, c.schedule, c.created_at
      FROM classes c
      ORDER BY c.class_id ASC
    `;
    const classes = await queryPrepared(sql, []);
    
    // 转换学费格式
    const formattedClasses = classes.map(c => ({
      ...c,
      fee_amount: formatAmount(c.fee_amount)
    }));

    res.json({ success: true, data: formattedClasses });
  } catch (err) {
    console.error('Error fetching classes:', err);
    res.status(500).json({ success: false, message: '获取班级列表失败', error: err.message });
  }
});

// 新增班级
app.post('/api/classes', async (req, res) => {
  try {
    const { class_name, subject, grade, teacher_name, fee_amount, schedule } = req.body;
    if (!class_name || !subject || !fee_amount) {
      return res.status(400).json({ success: false, message: '班级名称、科目和标准学费为必填项' });
    }

    const formattedFee = formatAmount(fee_amount);
    const sql = `
      INSERT INTO classes (class_name, subject, grade, teacher_name, fee_amount, schedule)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [class_name, subject, grade || '通用', teacher_name || '', formattedFee, schedule || ''];
    const result = await queryPrepared(sql, params);

    res.json({ success: true, message: '创建班级成功', data: { class_id: result.insertId } });
  } catch (err) {
    console.error('Error creating class:', err);
    res.status(500).json({ success: false, message: '创建班级失败', error: err.message });
  }
});

// ============================================================
// 4. 学费与收据 API (Payments & Receipt API)
// ============================================================

// 4.1 获取学费记录列表
app.get('/api/payments', async (req, res) => {
  try {
    const { month_year, status, keyword } = req.query;
    let sql = `
      SELECT p.payment_id, p.student_id, p.class_id, p.month_year, p.amount, 
             p.status, p.receipt_no, p.payment_date, p.updated_at,
             s.name AS student_name, s.student_code, s.parent_phone,
             c.class_name, c.subject
      FROM payments p
      JOIN students s ON p.student_id = s.student_id
      LEFT JOIN classes c ON p.class_id = c.class_id
      WHERE 1=1
    `;
    const params = [];

    if (month_year) {
      sql += ` AND p.month_year = ?`;
      params.push(month_year);
    }
    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }
    if (keyword) {
      sql += ` AND (s.name LIKE ? OR s.student_code LIKE ? OR p.receipt_no LIKE ?)`;
      const term = `%${keyword}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY p.payment_id DESC`;

    const payments = await queryPrepared(sql, params);
    const formattedPayments = payments.map(p => ({
      ...p,
      amount: formatAmount(p.amount)
    }));

    res.json({ success: true, data: formattedPayments });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ success: false, message: '获取缴费记录失败', error: err.message });
  }
});

// 4.2 生成/添加新应缴账单
app.post('/api/payments', async (req, res) => {
  try {
    const { student_id, class_id, month_year, amount } = req.body;
    if (!student_id || !month_year || !amount) {
      return res.status(400).json({ success: false, message: '学生ID、费用月份和金额为必填项' });
    }

    const formattedAmount = formatAmount(amount);
    const sql = `
      INSERT INTO payments (student_id, class_id, month_year, amount, status)
      VALUES (?, ?, ?, ?, 'Unpaid')
    `;
    const params = [parseInt(student_id, 10), class_id ? parseInt(class_id, 10) : null, month_year, formattedAmount];
    const result = await queryPrepared(sql, params);

    res.json({ success: true, message: '账单创建成功', data: { payment_id: result.insertId } });
  } catch (err) {
    console.error('Error creating payment bill:', err);
    res.status(500).json({ success: false, message: '创建账单失败', error: err.message });
  }
});

// 4.3 更新学费状态 API (核心：设为 Paid 时自动生成 RCP-YYYYMMDD-XXXX 收据单号)
app.put('/api/payments/:id/status', async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const { status, amount } = req.body; // status: Paid | Unpaid | Overdue

    if (!['Paid', 'Unpaid', 'Overdue'].includes(status)) {
      return res.status(400).json({ success: false, message: '非法支付状态' });
    }

    // 先查询当前记录
    const existing = await queryPrepared(
      'SELECT payment_id, status, receipt_no, amount FROM payments WHERE payment_id = ?',
      [paymentId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '未找到该缴费记录' });
    }

    let receiptNo = existing[0].receipt_no;
    let paymentDate = null;
    const finalAmount = amount ? formatAmount(amount) : formatAmount(existing[0].amount);

    if (status === 'Paid') {
      // 若设为已支付，且此前尚未生成收据单号，则自动生成 RCP-YYYYMMDD-XXXX
      if (!receiptNo) {
        receiptNo = generateReceiptNo(paymentId);
      }
      paymentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    } else {
      // 设为未付/逾期时，保留或重置收据
      paymentDate = null;
    }

    const sql = `
      UPDATE payments 
      SET status = ?, receipt_no = ?, payment_date = ?, amount = ?
      WHERE payment_id = ?
    `;
    const params = [status, receiptNo, paymentDate, finalAmount, paymentId];
    await queryPrepared(sql, params);

    res.json({
      success: true,
      message: status === 'Paid' ? '学费支付成功！已生成电子收据' : '学费状态已更新',
      data: {
        payment_id: paymentId,
        status,
        receipt_no: receiptNo,
        amount: finalAmount,
        payment_date: paymentDate
      }
    });
  } catch (err) {
    console.error('Error updating payment status:', err);
    res.status(500).json({ success: false, message: '更新支付状态失败', error: err.message });
  }
});

// 4.4 获取电子收据详情 API (用于预览/打印收据)
app.get('/api/payments/receipt/:id', async (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const sql = `
      SELECT p.payment_id, p.month_year, p.amount, p.status, p.receipt_no, p.payment_date,
             s.student_code, s.name AS student_name, s.grade AS student_grade, s.parent_name, s.parent_phone,
             c.class_name, c.subject, c.teacher_name
      FROM payments p
      JOIN students s ON p.student_id = s.student_id
      LEFT JOIN classes c ON p.class_id = c.class_id
      WHERE p.payment_id = ?
    `;
    const rows = await queryPrepared(sql, [paymentId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '未找到该收据记录' });
    }

    const receiptData = {
      ...rows[0],
      amount: formatAmount(rows[0].amount)
    };

    res.json({ success: true, data: receiptData });
  } catch (err) {
    console.error('Error fetching receipt detail:', err);
    res.status(500).json({ success: false, message: '获取收据详情失败', error: err.message });
  }
});

// ============================================================
// 5. 课堂点名与状态日志 API (Attendance & Roll Call API)
// ============================================================

// 5.1 获取某科目或班级在特定日期的学生考勤列表
app.get('/api/attendance', async (req, res) => {
  try {
    const { class_id, subject, date } = req.query;
    if (!class_id && !subject) {
      return res.status(400).json({ success: false, message: '必须指定点名科目或班级ID' });
    }

    const attendanceDate = date || new Date().toISOString().slice(0, 10);

    let sql = '';
    let params = [];

    if (subject) {
      // 查询报读该科目的所有在读学生以及该日期的点名记录
      sql = `
        SELECT s.student_id, s.student_code, s.name, s.gender, s.grade, s.enrolled_subjects,
               l.log_id, l.status AS attendance_status, l.remarks, l.attendance_date, l.subject
        FROM students s
        LEFT JOIN student_status_logs l ON s.student_id = l.student_id 
             AND l.subject = ? AND l.attendance_date = ?
        WHERE s.status = 'Active' AND s.enrolled_subjects LIKE ?
        ORDER BY s.student_id ASC
      `;
      params = [subject, attendanceDate, `%${subject}%`];
    } else {
      sql = `
        SELECT s.student_id, s.student_code, s.name, s.gender, s.grade, s.enrolled_subjects,
               l.log_id, l.status AS attendance_status, l.remarks, l.attendance_date
        FROM students s
        LEFT JOIN student_status_logs l ON s.student_id = l.student_id 
             AND l.class_id = ? AND l.attendance_date = ?
        WHERE s.status = 'Active'
        ORDER BY s.student_id ASC
      `;
      params = [parseInt(class_id, 10), attendanceDate];
    }

    const records = await queryPrepared(sql, params);

    res.json({
      success: true,
      data: {
        subject: subject || null,
        class_id: class_id ? parseInt(class_id, 10) : null,
        attendance_date: attendanceDate,
        records
      }
    });
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ success: false, message: '获取考勤点名数据失败', error: err.message });
  }
});

// 5.2 批量提交课堂点名 (Batch Submit Attendance API)
app.post('/api/attendance/batch', async (req, res) => {
  try {
    const { class_id, subject, attendance_date, logs } = req.body;

    if ((!class_id && !subject) || !attendance_date || !Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ success: false, message: '点名提交数据不完整' });
    }

    const classIdInt = class_id ? parseInt(class_id, 10) : null;
    const targetSubject = subject || '';

    // 使用事务保证批量更新的强一致性
    await withTransaction(async (conn) => {
      for (const item of logs) {
        const { student_id, status, remarks } = item;
        const studentIdInt = parseInt(student_id, 10);
        const attendanceStatus = status || 'Present';
        const remarkText = remarks || '';

        // 检查当日记录是否存在 (优先按科目或按班级匹配)
        let checkSql = '';
        let checkParams = [];
        if (targetSubject) {
          checkSql = 'SELECT log_id FROM student_status_logs WHERE student_id = ? AND subject = ? AND attendance_date = ?';
          checkParams = [studentIdInt, targetSubject, attendance_date];
        } else {
          checkSql = 'SELECT log_id FROM student_status_logs WHERE student_id = ? AND class_id = ? AND attendance_date = ?';
          checkParams = [studentIdInt, classIdInt, attendance_date];
        }

        const [existing] = await conn.execute(checkSql, checkParams);

        if (existing.length > 0) {
          // 更新已有日志
          await conn.execute(
            'UPDATE student_status_logs SET status = ?, remarks = ? WHERE log_id = ?',
            [attendanceStatus, remarkText, existing[0].log_id]
          );
        } else {
          // 插入新日志
          await conn.execute(
            'INSERT INTO student_status_logs (student_id, class_id, subject, attendance_date, status, remarks) VALUES (?, ?, ?, ?, ?, ?)',
            [studentIdInt, classIdInt, targetSubject || null, attendance_date, attendanceStatus, remarkText]
          );
        }
      }
    });

    res.json({
      success: true,
      message: `成功保存 ${logs.length} 位学员在【${targetSubject || '班级'}】的考勤点名记录`
    });
  } catch (err) {
    console.error('Error batch submitting attendance:', err);
    res.status(500).json({ success: false, message: '批量保存考勤失败', error: err.message });
  }
});

// ============================================================
// 6. 学习教材资料 API (Materials API)
// ============================================================
app.get('/api/materials', async (req, res) => {
  try {
    const { class_id, subject, keyword } = req.query;
    let sql = `
      SELECT m.material_id, m.class_id, m.title, m.subject, m.file_url, 
             m.category, m.uploaded_at, c.class_name
      FROM materials m
      LEFT JOIN classes c ON m.class_id = c.class_id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) {
      sql += ` AND (m.class_id = ? OR m.class_id IS NULL)`;
      params.push(parseInt(class_id, 10));
    }
    if (subject) {
      sql += ` AND m.subject = ?`;
      params.push(subject);
    }
    if (keyword) {
      sql += ` AND (m.title LIKE ? OR m.category LIKE ?)`;
      const term = `%${keyword}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY m.material_id DESC`;

    const materials = await queryPrepared(sql, params);
    res.json({ success: true, data: materials });
  } catch (err) {
    console.error('Error fetching materials:', err);
    res.status(500).json({ success: false, message: '获取资料列表失败', error: err.message });
  }
});

app.post('/api/materials', async (req, res) => {
  try {
    const { class_id, title, subject, file_url, category } = req.body;
    if (!title || !subject || !file_url) {
      return res.status(400).json({ success: false, message: '资料名称、科目和链接为必填项' });
    }

    const sql = `
      INSERT INTO materials (class_id, title, subject, file_url, category)
      VALUES (?, ?, ?, ?, ?)
    `;
    const params = [class_id ? parseInt(class_id, 10) : null, title, subject, file_url, category || '讲义'];
    const result = await queryPrepared(sql, params);

    res.json({ success: true, message: '添加教材资料成功', data: { material_id: result.insertId } });
  } catch (err) {
    console.error('Error creating material:', err);
    res.status(500).json({ success: false, message: '添加教材资料失败', error: err.message });
  }
});

app.delete('/api/materials/:id', async (req, res) => {
  try {
    const materialId = parseInt(req.params.id, 10);
    await queryPrepared('DELETE FROM materials WHERE material_id = ?', [materialId]);
    res.json({ success: true, message: '删除资料成功' });
  } catch (err) {
    console.error('Error deleting material:', err);
    res.status(500).json({ success: false, message: '删除资料失败', error: err.message });
  }
});

// ============================================================
// 7. 后台通知控制台 API (Admin Notice Console API)
// ============================================================
app.get('/api/notices', async (req, res) => {
  try {
    const sql = `
      SELECT notice_id, template_key, target_type, title, target_summary,
             student_id, student_name, parent_phone, content, created_at
      FROM notices
      ORDER BY notice_id DESC
      LIMIT 100
    `;
    const notices = await queryPrepared(sql, []);
    res.json({ success: true, data: notices });
  } catch (err) {
    console.error('Error fetching notices:', err);
    res.status(500).json({ success: false, message: '获取通知记录失败', error: err.message });
  }
});

app.post('/api/notices', async (req, res) => {
  try {
    const { template_key, target_type, title, target_summary, student_id, student_name, parent_phone, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: '通知标题与内容不能为空' });
    }

    const sql = `
      INSERT INTO notices (template_key, target_type, title, target_summary, student_id, student_name, parent_phone, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      template_key || 'custom',
      target_type || 'all',
      title,
      target_summary || '',
      student_id ? parseInt(student_id, 10) : null,
      student_name || '',
      parent_phone || '',
      content
    ];

    const result = await queryPrepared(sql, params);
    res.json({
      success: true,
      message: '通知记录已成功归档保存',
      data: { notice_id: result.insertId }
    });
  } catch (err) {
    console.error('Error saving notice:', err);
    res.status(500).json({ success: false, message: '保存通知记录失败', error: err.message });
  }
});

app.delete('/api/notices/:id', async (req, res) => {
  try {
    const noticeId = parseInt(req.params.id, 10);
    await queryPrepared('DELETE FROM notices WHERE notice_id = ?', [noticeId]);
    res.json({ success: true, message: '通知记录已删除' });
  } catch (err) {
    console.error('Error deleting notice:', err);
    res.status(500).json({ success: false, message: '删除通知记录失败', error: err.message });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` Tuition Centre Management System Server Running `);
  console.log(` Port: ${PORT}`);
  console.log(` Environment: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
