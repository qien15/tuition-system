/**
 * public/tuition_management.js
 * 补习中心综合管理系统 (Tuition Centre Management System) 前端客户端逻辑
 * 模块: TuitionAdminApp
 */

const TuitionAdminApp = (function () {
  const state = {
    students: [],
    classes: [],
    payments: [],
    attendanceRecords: [],
    materials: [],
    currentClassId: null,
    currentAttendanceDate: new Date().toISOString().slice(0, 10)
  };

  async function init() {
    const datePicker = document.getElementById('attendanceDatePicker');
    if (datePicker) {
      datePicker.value = state.currentAttendanceDate;
    }

    const monthPicker = document.getElementById('filterPaymentMonth');
    if (monthPicker) {
      monthPicker.value = new Date().toISOString().slice(0, 7);
    }
    const billMonthPicker = document.getElementById('billMonthYear');
    if (billMonthPicker) {
      billMonthPicker.value = new Date().toISOString().slice(0, 7);
    }

    await Promise.all([
      loadDashboardStats(),
      loadStudents(),
      loadClasses(),
      loadPayments(),
      loadMaterials()
    ]);

    setupEventListeners();
  }

  function setupEventListeners() {
    const searchStudent = document.getElementById('searchStudentInput');
    if (searchStudent) {
      searchStudent.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') loadStudents();
      });
    }

    const searchPayment = document.getElementById('searchPaymentInput');
    if (searchPayment) {
      searchPayment.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') loadPayments();
      });
    }

    const billClassSelect = document.getElementById('billClassSelect');
    if (billClassSelect) {
      billClassSelect.addEventListener('change', (e) => {
        const classId = parseInt(e.target.value, 10);
        const selectedClass = state.classes.find(c => c.class_id === classId);
        if (selectedClass) {
          document.getElementById('billAmount').value = getRawAmount(selectedClass.fee_amount);
        }
      });
    }
  }

  function showToast(message, type = 'success') {
    const toastEl = document.getElementById('appToast');
    const toastMsg = document.getElementById('toastMessage');
    if (!toastEl || !toastMsg) return;

    toastMsg.textContent = message;
    toastEl.className = `toast align-items-center text-white border-0 bg-${type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'success'}`;
    const bsToast = new bootstrap.Toast(toastEl, { delay: 3500 });
    bsToast.show();
  }

  function formatMoney(amount) {
    const num = parseFloat(amount);
    return isNaN(num) ? 'RM 0.00' : `RM ${num.toFixed(2)}`;
  }

  function getRawAmount(amount) {
    const num = parseFloat(amount);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  }

  function switchTab(tabId) {
    const tabBtn = document.getElementById(tabId);
    if (tabBtn) {
      const triggerEl = new bootstrap.Tab(tabBtn);
      triggerEl.show();
    }
  }

  // ============================================================
  // 1. 仪表盘统计与数据刷新
  // ============================================================
  async function loadDashboardStats() {
    try {
      const res = await fetch('/api/dashboard/stats');
      const json = await res.json();
      if (json.success) {
        const { totalStudents, totalClasses, totalPaidAmount, unpaidCount } = json.data;
        document.getElementById('statTotalStudents').textContent = totalStudents;
        document.getElementById('statTotalClasses').textContent = totalClasses;
        document.getElementById('statPaidAmount').textContent = formatMoney(totalPaidAmount);
        document.getElementById('statUnpaidCount').textContent = unpaidCount;
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    }
  }

  // ============================================================
  // 2. 学生档案管理模块
  // ============================================================
  async function loadStudents() {
    const keyword = document.getElementById('searchStudentInput')?.value || '';
    const grade = document.getElementById('filterStudentGrade')?.value || '';
    
    const params = new URLSearchParams();
    if (keyword) params.append('keyword', keyword);
    if (grade) params.append('grade', grade);

    try {
      const res = await fetch(`/api/students?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        state.students = json.data;
        renderStudentsTable(state.students);
        populateStudentDropdowns(state.students);
      } else {
        showToast(json.message || '获取学生列表失败', 'error');
      }
    } catch (err) {
      showToast('网络错误，无法加载学生列表', 'error');
    }
  }

  function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>未找到匹配的学生记录</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => `
      <tr>
        <td class="fw-bold text-primary">${s.student_code}</td>
        <td class="fw-bold">${s.name}</td>
        <td>${s.gender === 'Male' ? '<span class="badge bg-primary-subtle text-primary">男</span>' : '<span class="badge bg-danger-subtle text-danger">女</span>'}</td>
        <td><span class="badge bg-secondary-subtle text-secondary-emphasis">${s.grade}</span></td>
        <td>${s.phone || '-'}</td>
        <td>${s.parent_name || '-'}</td>
        <td><i class="bi bi-telephone-fill me-1 text-success small"></i>${s.parent_phone}</td>
        <td>
          ${s.status === 'Active' 
            ? '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check-circle-fill me-1"></i>在读</span>' 
            : '<span class="badge bg-secondary-subtle text-secondary">离校</span>'}
        </td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="TuitionAdminApp.quickCreateBillForStudent(${s.student_id})">
            <i class="bi bi-receipt me-1"></i>发账单
          </button>
        </td>
      </tr>
    `).join('');
  }

  function populateStudentDropdowns(students) {
    const billSelect = document.getElementById('billStudentSelect');
    if (!billSelect) return;

    billSelect.innerHTML = `<option value="">-- 请选择学生 --</option>` +
      students.map(s => `<option value="${s.student_id}">${s.name} (${s.student_code} - ${s.grade})</option>`).join('');
  }

  async function submitAddStudent(e) {
    e.preventDefault();
    const student_code = document.getElementById('newStudentCode').value.trim();
    const name = document.getElementById('newStudentName').value.trim();
    const gender = document.getElementById('newStudentGender').value;
    const grade = document.getElementById('newStudentGrade').value;
    const phone = document.getElementById('newStudentPhone').value.trim();
    const parent_name = document.getElementById('newStudentParentName').value.trim();
    const parent_phone = document.getElementById('newStudentParentPhone').value.trim();

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_code, name, gender, grade, phone, parent_name, parent_phone })
      });
      const json = await res.json();

      if (json.success) {
        showToast(json.message || '添加学生成功！');
        document.getElementById('addStudentForm').reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
        if (modal) modal.hide();
        await loadStudents();
        await loadDashboardStats();
      } else {
        showToast(json.message || '添加学生失败', 'error');
      }
    } catch (err) {
      showToast('系统错误，无法添加学生', 'error');
    }
  }

  // ============================================================
  // 3. 班级课程管理模块
  // ============================================================
  async function loadClasses() {
    try {
      const res = await fetch('/api/classes');
      const json = await res.json();

      if (json.success) {
        state.classes = json.data;
        populateClassDropdowns(state.classes);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  }

  function populateClassDropdowns(classes) {
    const attendSelect = document.getElementById('attendanceClassSelect');
    const billSelect = document.getElementById('billClassSelect');
    const matSelect = document.getElementById('matClassSelect');

    const options = classes.map(c => 
      `<option value="${c.class_id}">${c.class_name} [${c.subject} - ${formatMoney(c.fee_amount)}]</option>`
    ).join('');

    if (attendSelect) attendSelect.innerHTML = `<option value="">-- 请选择班级 --</option>` + options;
    if (billSelect) billSelect.innerHTML = `<option value="">-- 选择班级 (自动读取标准学费) --</option>` + options;
    if (matSelect) matSelect.innerHTML = `<option value="">-- 全员通用资料 --</option>` + options;
  }

  async function submitAddClass(e) {
    e.preventDefault();
    const class_name = document.getElementById('newClassName').value.trim();
    const subject = document.getElementById('newClassSubject').value.trim();
    const grade = document.getElementById('newClassGrade').value.trim();
    const teacher_name = document.getElementById('newClassTeacher').value.trim();
    const fee_amount = document.getElementById('newClassFee').value;
    const schedule = document.getElementById('newClassSchedule').value.trim();

    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name, subject, grade, teacher_name, fee_amount, schedule })
      });
      const json = await res.json();

      if (json.success) {
        showToast('创建班级成功！');
        document.getElementById('addClassForm').reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('addClassModal'));
        if (modal) modal.hide();
        await loadClasses();
        await loadDashboardStats();
      } else {
        showToast(json.message || '创建班级失败', 'error');
      }
    } catch (err) {
      showToast('系统错误，无法创建班级', 'error');
    }
  }

  // ============================================================
  // 4. 课堂点名与评价模块 (Attendance & Roll Call - Subject Based)
  // ============================================================
  async function loadAttendanceRollCall() {
    const subjectSelect = document.getElementById('attendanceSubjectSelect') || document.getElementById('attendanceClassSelect');
    const datePicker = document.getElementById('attendanceDatePicker');
    const summaryEl = document.getElementById('attendanceAudienceSummary');
    const badgeEl = document.getElementById('attendanceStudentCountBadge');
    const tbody = document.getElementById('attendanceTableBody');
    
    if (!subjectSelect || !subjectSelect.value) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-info-circle me-1"></i>请先在上方选择点名科目 (Select Subject)</td></tr>`;
      }
      if (badgeEl) badgeEl.innerHTML = `<i class="bi bi-people me-1"></i> 名册学员: 0 人`;
      if (summaryEl) summaryEl.innerHTML = `<i class="bi bi-info-circle me-1"></i>请先在上方选择科目，系统将自动联动仅展示已报读该科目的学员`;
      return;
    }

    const selectedSubject = subjectSelect.value;
    const date = datePicker ? datePicker.value : state.currentAttendanceDate;
    state.currentSubject = selectedSubject;
    state.currentAttendanceDate = date;

    try {
      const res = await fetch(`/api/attendance?subject=${encodeURIComponent(selectedSubject)}&date=${date}`);
      const json = await res.json();

      if (json.success) {
        state.attendanceRecords = json.data.records;
        if (badgeEl) {
          badgeEl.innerHTML = `<i class="bi bi-people me-1"></i> 已报读: ${state.attendanceRecords.length} 人`;
        }
        if (summaryEl) {
          summaryEl.innerHTML = `<i class="bi bi-bookmark-check-fill text-primary me-1"></i>当前正在点名：<strong class="text-dark">${selectedSubject}</strong>（${date}），已匹配到 ${state.attendanceRecords.length} 名报读学员`;
        }
        renderAttendanceTable(state.attendanceRecords, selectedSubject);
      } else {
        showToast(json.message || '加载考勤名册失败', 'error');
      }
    } catch (err) {
      showToast('网络异常，无法加载点名表', 'error');
    }
  }

  function renderAttendanceTable(records, currentSubject = '') {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-exclamation-circle text-warning me-1"></i>当前科目【${currentSubject || ''}】暂无已报读学员</td></tr>`;
      return;
    }

    const quickTags = [
      '积极发言', '完成作业', '思维敏捷', '解题规范',
      '基础扎实', '迟到15分钟', '注意力集中', '需个别辅导'
    ];

    tbody.innerHTML = records.map(r => {
      const currentStatus = r.attendance_status || 'Present';
      const currentRemarks = r.remarks || '';

      const subjectsArr = r.enrolled_subjects
        ? (Array.isArray(r.enrolled_subjects) ? r.enrolled_subjects : r.enrolled_subjects.split(',').map(x => x.trim()))
        : [];

      const subjectBadges = subjectsArr.map(sub => {
        if (sub === currentSubject) {
          return `<span class="badge bg-primary text-white me-1 mb-1 shadow-sm"><i class="bi bi-check-lg me-1"></i>${sub}</span>`;
        }
        return `<span class="badge bg-light text-secondary border me-1 mb-1">${sub}</span>`;
      }).join('');

      return `
        <tr data-student-id="${r.student_id}">
          <td class="fw-bold text-secondary">${r.student_code}</td>
          <td class="fw-bold fs-6 text-dark">${r.name}</td>
          <td><span class="badge bg-light text-dark border">${r.grade}</span></td>
          <td style="max-width: 220px;">${subjectBadges || '<span class="text-muted small">未设置</span>'}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              <input type="radio" class="btn-check" name="status_${r.student_id}" id="att_present_${r.student_id}" value="Present" ${currentStatus === 'Present' ? 'checked' : ''}>
              <label class="btn btn-outline-success" for="att_present_${r.student_id}"><i class="bi bi-circle-fill text-success me-1"></i>出席</label>

              <input type="radio" class="btn-check" name="status_${r.student_id}" id="att_late_${r.student_id}" value="Late" ${currentStatus === 'Late' ? 'checked' : ''}>
              <label class="btn btn-outline-warning" for="att_late_${r.student_id}"><i class="bi bi-exclamation-circle text-warning me-1"></i>迟到</label>

              <input type="radio" class="btn-check" name="status_${r.student_id}" id="att_absent_${r.student_id}" value="Absent" ${currentStatus === 'Absent' ? 'checked' : ''}>
              <label class="btn btn-outline-danger" for="att_absent_${r.student_id}"><i class="bi bi-x-circle text-danger me-1"></i>缺席</label>

              <input type="radio" class="btn-check" name="status_${r.student_id}" id="att_excused_${r.student_id}" value="Excused" ${currentStatus === 'Excused' ? 'checked' : ''}>
              <label class="btn btn-outline-secondary" for="att_excused_${r.student_id}"><i class="bi bi-person-exclamation me-1"></i>请假</label>
            </div>
          </td>
          <td>
            <div class="mb-1 d-flex flex-wrap gap-1">
              ${quickTags.map(tag => `
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle tag-btn" 
                      style="cursor: pointer;"
                      onclick="TuitionAdminApp.appendRemarkTag(${r.student_id}, '${tag}')">
                  <i class="bi bi-pencil-square me-1"></i>${tag}
                </span>
              `).join('')}
            </div>
            <input type="text" id="remark_input_${r.student_id}" class="form-control form-control-sm rounded-2 mt-1" 
                   value="${currentRemarks}" placeholder="添加课堂评价或备注...">
          </td>
        </tr>
      `;
    }).join('');
  }

  function setAllAttendancePresent() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    const radios = tbody.querySelectorAll('input[type="radio"][value="Present"]');
    if (radios.length === 0) {
      showToast('请先选择点名科目并加载名册！', 'warning');
      return;
    }

    radios.forEach(radio => {
      radio.checked = true;
    });

    showToast(`已将【${state.currentSubject || '当前科目'}】名册学员一键设为【出席】！`, 'success');
  }

  function appendRemarkTag(studentId, tagText) {
    const input = document.getElementById(`remark_input_${studentId}`);
    if (!input) return;

    const currentVal = input.value.trim();
    if (currentVal.length === 0) {
      input.value = tagText;
    } else if (!currentVal.includes(tagText)) {
      input.value = `${currentVal}, ${tagText}`;
    }
  }

  async function submitBatchAttendance() {
    const subjectSelect = document.getElementById('attendanceSubjectSelect') || document.getElementById('attendanceClassSelect');
    const datePicker = document.getElementById('attendanceDatePicker');
    const subject = subjectSelect ? subjectSelect.value : null;
    const date = datePicker ? datePicker.value : null;

    if (!subject) {
      showToast('请先选择点名科目！', 'warning');
      return;
    }
    if (!date) {
      showToast('请选择点名日期！', 'warning');
      return;
    }

    const rows = document.querySelectorAll('#attendanceTableBody tr[data-student-id]');
    if (rows.length === 0) {
      showToast('无有效学生点名数据可提交', 'warning');
      return;
    }

    const logs = [];
    rows.forEach(row => {
      const studentId = row.getAttribute('data-student-id');
      const selectedStatus = row.querySelector(`input[name="status_${studentId}"]:checked`)?.value || 'Present';
      const remarks = document.getElementById(`remark_input_${studentId}`)?.value.trim() || '';

      logs.push({
        student_id: parseInt(studentId, 10),
        status: selectedStatus,
        remarks: remarks
      });
    });

    try {
      const res = await fetch('/api/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject,
          attendance_date: date,
          logs
        })
      });
      const json = await res.json();

      if (json.success) {
        showToast(json.message || `成功保存【${subject}】考勤记录！`);
        await loadAttendanceRollCall();
      } else {
        showToast(json.message || '保存考勤失败', 'error');
      }
    } catch (err) {
      showToast('网络故障，批量提交失败', 'error');
    }
  }

  // ============================================================
  // 5. 学费管理与电子收据模块 (Payments & Receipts & Excel Export)
  // ============================================================
  async function loadPayments() {
    const month = document.getElementById('filterPaymentMonth')?.value || '';
    const status = document.getElementById('filterPaymentStatus')?.value || '';
    const keyword = document.getElementById('searchPaymentInput')?.value || '';

    const params = new URLSearchParams();
    if (month) params.append('month_year', month);
    if (status) params.append('status', status);
    if (keyword) params.append('keyword', keyword);

    try {
      const res = await fetch(`/api/payments?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        state.payments = json.data;
        renderPaymentsTable(state.payments);
        renderDashboardRecentPayments(state.payments.slice(0, 5));
      } else {
        showToast(json.message || '获取缴费记录失败', 'error');
      }
    } catch (err) {
      showToast('网络错误，无法获取缴费记录', 'error');
    }
  }

  function renderPaymentsTable(payments) {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    if (payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>暂无符合条件的缴费记录</td></tr>`;
      return;
    }

    tbody.innerHTML = payments.map(p => {
      const formattedAmt = formatMoney(p.amount);
      const rawAmt = getRawAmount(p.amount);
      const isPaid = p.status === 'Paid';
      const statusBadge = isPaid 
        ? `<span class="badge-paid"><i class="bi bi-check-circle-fill me-1"></i>已缴费 (Paid)</span>` 
        : p.status === 'Overdue' 
          ? `<span class="badge-overdue"><i class="bi bi-exclamation-circle-fill me-1"></i>已逾期 (Overdue)</span>`
          : `<span class="badge-unpaid"><i class="bi bi-clock-history me-1"></i>未缴费 (Unpaid)</span>`;

      return `
        <tr>
          <td class="fw-bold text-secondary">#${p.payment_id}</td>
          <td class="fw-bold">${p.student_name} <span class="small text-muted">(${p.student_code})</span></td>
          <td>${p.class_name || '补习课程费用'}</td>
          <td><span class="badge bg-light text-dark border">${p.month_year}</span></td>
          <td class="fw-bold text-dark fs-6">${formattedAmt}</td>
          <td>${statusBadge}</td>
          <td>
            ${p.receipt_no 
              ? `<code class="fw-bold text-primary bg-light px-2 py-1 rounded">${p.receipt_no}</code>` 
              : `<span class="text-muted small">未派发</span>`}
          </td>
          <td class="small text-muted">${p.updated_at ? p.updated_at.substring(0, 16) : '-'}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="TuitionAdminApp.openUpdatePaymentModal(${p.payment_id}, '${p.student_name}', '${p.month_year}', '${p.status}', '${rawAmt}')">
                <i class="bi bi-pencil-square me-1"></i>改状态
              </button>
              ${isPaid 
                ? `<button class="btn btn-success" onclick="TuitionAdminApp.openReceiptModal(${p.payment_id})"><i class="bi bi-printer me-1"></i>收据凭证</button>` 
                : `<button class="btn btn-outline-success" onclick="TuitionAdminApp.quickSetPaid(${p.payment_id})"><i class="bi bi-check-circle me-1"></i>设为已缴</button>`}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderDashboardRecentPayments(payments) {
    const tbody = document.getElementById('dashboardRecentPaymentsTable');
    if (!tbody) return;

    if (payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">近期无学费记录</td></tr>`;
      return;
    }

    tbody.innerHTML = payments.map(p => `
      <tr>
        <td class="fw-bold">${p.student_name}</td>
        <td>${p.class_name || '常规补习'}</td>
        <td>${p.month_year}</td>
        <td class="fw-bold text-dark">${formatMoney(p.amount)}</td>
        <td>
          ${p.status === 'Paid' 
            ? '<span class="badge bg-success-subtle text-success"><i class="bi bi-check-circle-fill me-1"></i>已缴费</span>' 
            : '<span class="badge bg-warning-subtle text-warning"><i class="bi bi-clock-history me-1"></i>待缴费</span>'}
        </td>
        <td><small class="text-muted">${p.receipt_no || '-'}</small></td>
      </tr>
    `).join('');
  }

  function exportPaymentsToCSV() {
    const payments = state.payments || [];
    if (payments.length === 0) {
      showToast('暂无学费记录可供导出', 'warning');
      return;
    }

    let csvContent = "\uFEFF";
    csvContent += "账单编号,学生姓名,学号,关联班级/科目,账单月份,学费金额 (RM),支付状态,电子收据单号,付款日期\n";

    let totalPaidRM = 0;
    payments.forEach(p => {
      const amt = parseFloat(p.amount || 0);
      if (p.status === 'Paid') totalPaidRM += amt;
      const row = [
        `"${p.payment_id || ''}"`,
        `"${p.student_name || ''}"`,
        `"${p.student_code || ''}"`,
        `"${p.class_name || '常规补习'}"`,
        `"${p.month_year || ''}"`,
        `"RM ${amt.toFixed(2)}"`,
        `"${p.status === 'Paid' ? '已缴费' : p.status === 'Overdue' ? '已逾期' : '未缴费'}"`,
        `"${p.receipt_no || '-'}"`,
        `"${p.payment_date || '-'}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    csvContent += `,,,,,实收学费总计 (RM),"RM ${totalPaidRM.toFixed(2)}",,\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Tuition_Fee_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Excel 导出成功！表头与汇总行已标示 (RM)");
  }

  function quickCreateBillForStudent(studentId) {
    switchTab('payments-tab');
    const modalEl = document.getElementById('createPaymentModal');
    if (modalEl) {
      const select = document.getElementById('billStudentSelect');
      if (select) select.value = studentId;
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();
    }
  }

  async function submitCreatePaymentBill(e) {
    e.preventDefault();
    const student_id = document.getElementById('billStudentSelect').value;
    const class_id = document.getElementById('billClassSelect').value;
    const month_year = document.getElementById('billMonthYear').value;
    const amount = document.getElementById('billAmount').value;

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id, class_id, month_year, amount })
      });
      const json = await res.json();

      if (json.success) {
        showToast('学费账单生成成功！');
        document.getElementById('createPaymentForm').reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('createPaymentModal'));
        if (modal) modal.hide();
        await loadPayments();
        await loadDashboardStats();
      } else {
        showToast(json.message || '账单创建失败', 'error');
      }
    } catch (err) {
      showToast('系统异常，无法生成账单', 'error');
    }
  }

  function openUpdatePaymentModal(paymentId, studentName, monthYear, currentStatus, currentAmount) {
    document.getElementById('editPaymentId').value = paymentId;
    document.getElementById('editPaymentStudentName').textContent = studentName;
    document.getElementById('editPaymentMonth').textContent = monthYear;
    document.getElementById('editPaymentStatus').value = currentStatus;
    document.getElementById('editPaymentAmount').value = getRawAmount(currentAmount);

    const modal = new bootstrap.Modal(document.getElementById('updatePaymentModal'));
    modal.show();
  }

  async function quickSetPaid(paymentId) {
    try {
      const res = await fetch(`/api/payments/${paymentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Paid' })
      });
      const json = await res.json();

      if (json.success) {
        showToast(`操作成功！学费已设为已缴，收据号：${json.data.receipt_no}`);
        await loadPayments();
        await loadDashboardStats();
        openReceiptModal(paymentId);
      } else {
        showToast(json.message || '更改状态失败', 'error');
      }
    } catch (err) {
      showToast('网络错误，无法设为已缴费', 'error');
    }
  }

  async function submitUpdatePaymentStatus(e) {
    e.preventDefault();
    const paymentId = document.getElementById('editPaymentId').value;
    const status = document.getElementById('editPaymentStatus').value;
    const amount = document.getElementById('editPaymentAmount').value;

    try {
      const res = await fetch(`/api/payments/${paymentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, amount })
      });
      const json = await res.json();

      if (json.success) {
        showToast(json.message || '支付状态已成功更新');
        const modal = bootstrap.Modal.getInstance(document.getElementById('updatePaymentModal'));
        if (modal) modal.hide();
        await loadPayments();
        await loadDashboardStats();
      } else {
        showToast(json.message || '更新状态失败', 'error');
      }
    } catch (err) {
      showToast('系统异常，无法更新支付状态', 'error');
    }
  }

  async function openReceiptModal(paymentId) {
    try {
      const res = await fetch(`/api/payments/receipt/${paymentId}`);
      const json = await res.json();

      if (json.success) {
        const d = json.data;
        document.getElementById('rcpNumber').textContent = d.receipt_no || 'RCP-UNKNOWN';
        document.getElementById('rcpStudentName').textContent = d.student_name;
        document.getElementById('rcpStudentCode').textContent = d.student_code;
        document.getElementById('rcpClassName').textContent = d.class_name ? `${d.class_name} (${d.subject})` : '常规补习课程学费';
        document.getElementById('rcpParentPhone').textContent = d.parent_phone;
        document.getElementById('rcpSubjectDesc').textContent = d.class_name ? `${d.class_name} 每月学费` : '补习课程学费';
        document.getElementById('rcpMonthYear').textContent = d.month_year;
        document.getElementById('rcpAmount').textContent = formatMoney(d.amount);
        document.getElementById('rcpPaymentDate').textContent = d.payment_date || new Date().toLocaleString();

        const modal = new bootstrap.Modal(document.getElementById('receiptModal'));
        modal.show();
      } else {
        showToast(json.message || '无法获取收据详情', 'error');
      }
    } catch (err) {
      showToast('网络错误，无法查看收据凭证', 'error');
    }
  }

  function printReceipt() {
    window.print();
  }

  // ============================================================
  // 6. 学习教材资料模块 (Materials)
  // ============================================================
  async function loadMaterials() {
    const subject = document.getElementById('filterMaterialSubject')?.value || '';
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);

    try {
      const res = await fetch(`/api/materials?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        state.materials = json.data;
        renderMaterialsTable(state.materials);
      }
    } catch (err) {
      console.error('Error loading materials:', err);
    }
  }

  function renderMaterialsTable(materials) {
    const tbody = document.getElementById('materialsTableBody');
    if (!tbody) return;

    if (materials.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">暂无学习教材资料</td></tr>`;
      return;
    }

    tbody.innerHTML = materials.map(m => `
      <tr>
        <td class="fw-bold text-secondary">#${m.material_id}</td>
        <td class="fw-bold"><i class="bi bi-file-earmark-pdf text-danger me-2"></i>${m.title}</td>
        <td><span class="badge bg-primary-subtle text-primary">${m.subject}</span></td>
        <td><span class="badge bg-info-subtle text-info">${m.category || '讲义'}</span></td>
        <td>${m.class_name || '通用公共资料'}</td>
        <td>
          <a href="${m.file_url}" target="_blank" class="btn btn-sm btn-link text-decoration-none">
            <i class="bi bi-box-arrow-up-right me-1"></i>预览/下载
          </a>
        </td>
        <td class="small text-muted">${m.uploaded_at ? m.uploaded_at.substring(0, 10) : '-'}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-danger" onclick="TuitionAdminApp.deleteMaterial(${m.material_id})">
            <i class="bi bi-trash me-1"></i>删除
          </button>
        </td>
      </tr>
    `).join('');
  }

  async function submitAddMaterial(e) {
    e.preventDefault();
    const title = document.getElementById('matTitle').value.trim();
    const subject = document.getElementById('matSubject').value;
    const category = document.getElementById('matCategory').value;
    const class_id = document.getElementById('matClassSelect').value;
    const file_url = document.getElementById('matFileUrl').value.trim();

    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subject, category, class_id, file_url })
      });
      const json = await res.json();

      if (json.success) {
        showToast('教材资料上传成功！');
        document.getElementById('addMaterialForm').reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('addMaterialModal'));
        if (modal) modal.hide();
        await loadMaterials();
      } else {
        showToast(json.message || '上传资料失败', 'error');
      }
    } catch (err) {
      showToast('系统异常，无法上传资料', 'error');
    }
  }

  async function deleteMaterial(id) {
    if (!confirm('确定要删除这份教材资料吗？')) return;

    try {
      const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        showToast('资料已成功删除');
        await loadMaterials();
      } else {
        showToast(json.message || '删除资料失败', 'error');
      }
    } catch (err) {
      showToast('网络错误，无法删除', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    init,
    switchTab,
    loadStudents,
    submitAddStudent,
    loadClasses,
    submitAddClass,
    loadAttendanceRollCall,
    setAllAttendancePresent,
    appendRemarkTag,
    submitBatchAttendance,
    loadPayments,
    quickCreateBillForStudent,
    submitCreatePaymentBill,
    openUpdatePaymentModal,
    quickSetPaid,
    submitUpdatePaymentStatus,
    openReceiptModal,
    printReceipt,
    exportPaymentsToCSV,
    loadMaterials,
    submitAddMaterial,
    deleteMaterial
  };
})();
