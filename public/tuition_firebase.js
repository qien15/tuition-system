/**
 * tuition_firebase.js
 * 补习中心综合管理系统 (Tuition Centre Management System)
 * 纯前端 Serverless 架构 - 基于 Modular Firebase v10 JS SDK
 */

import { auth, db, isConfigured } from './firebase-config.js';
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  writeBatch, 
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 内置通知模板库 (Built-in Notice Templates)
const NOTICE_TEMPLATES = {
  monthly_fee: {
    title: '{month}月份学费缴交温馨提醒',
    content: `尊敬的{parent_name}家长：
您好！这里是{centre_name}。
温馨提醒您，学员【{student_name}】（{grade}）{month}月份的学费账单已发布，学费金额为：{fee_amount}。
报读科目：{subjects}。
请于本月10日前完成学费缴纳。如已完成缴费，请忽略此通知。感谢您对我们教学工作的支持与配合！`
  },
  overdue_fee: {
    title: '学费逾期催缴重要通知',
    content: `尊敬的{parent_name}家长：
您好！系统显示学员【{student_name}】（{grade}）尚有未缴纳的学费，应缴金额为：{fee_amount}。
报读科目：{subjects}。
为确保学生的课程学习与教学辅导正常进行，烦请您尽快核对并完成支付。如有任何疑问或需查验收据，请随时与我们财务处联系。感谢您的理解与协助！`
  },
  holiday: {
    title: '学校假期及中心放假停课通告',
    content: `尊敬的各位家长与同学：
您好！接教育局及本中心教学安排，{centre_name}将于【{holiday_date}】起进行假期停课，所有常规课程暂停。
复课时间定于【{resume_date}】，届时请各位同学按原课程表准时出席上课。假期期间请同学们合理规划自主学习与作业复习。祝大家假期充实愉快！`
  },
  reschedule: {
    title: '关于班级课程临时调整与补课通知',
    content: `尊敬的{parent_name}家长：
您好！因教学进度及任课教师教研安排，学员【{student_name}】报读的【{adjusted_course}】课程原定上课时间将调整至：【{new_schedule}】进行补课。
上课地点与线上课堂链接保持不变，请学员做好预习并准时参加。给您带来不便，敬请谅解！`
  },
  exam: {
    title: '期末综合模拟测评及月考安排通知',
    content: `尊敬的{parent_name}家长：
您好！为检验阶段性学习成果并针对性查漏补缺，{centre_name}将针对【{grade}】组织全真阶段模拟测评。
学员姓名：【{student_name}】
测试科目：{subjects}
考试日期：【{exam_date}】
请督促孩子按时复习重点知识与错题本，准时入场应试。考试成绩分析及个性化提分方案将于考后统一反馈，谢谢！`
  },
  feedback: {
    title: '学员课堂表现与个性化学情反馈',
    content: `尊敬的{parent_name}家长：
您好！我是{centre_name}的任课教师。特向您反馈学员【{student_name}】（{grade}）近期在【{subjects}】课堂上的学习进展：
近期表现：{recent_performance}。
课堂建议：已掌握核心解题技巧，建议课后强化巩固易错题型。孩子学习态度认真，进步显著！家校携手，共同见证孩子的成长与蜕变。`
  }
};

// 内存示例备用数据库 (Demo Data Fallback when Firebase Key is placeholder)
const demoStore = {
  students: [
    { id: 'STU_1', student_code: 'STU2026001', name: '张小明', gender: 'Male', phone: '60120013801', parent_name: '张伟', parent_phone: '60121112222', grade: '高中二年级', enrolled_subjects: ['Mathematics', 'Add Maths', 'Physics'], base_fee: '240.00', status: 'Active' },
    { id: 'STU_2', student_code: 'STU2026002', name: '李思思', gender: 'Female', phone: '60120013802', parent_name: '李建国', parent_phone: '60123334444', grade: '初中三年级', enrolled_subjects: ['English', 'Bahasa Melayu', 'Science'], base_fee: '240.00', status: 'Active' },
    { id: 'STU_3', student_code: 'STU2026003', name: '王梓豪', gender: 'Male', phone: '60120013803', parent_name: '王强', parent_phone: '60125556666', grade: '高中二年级', enrolled_subjects: ['Mathematics', 'Chemistry'], base_fee: '160.00', status: 'Active' },
    { id: 'STU_4', student_code: 'STU2026004', name: '陈佳欣', gender: 'Female', phone: '60120013804', parent_name: '陈光明', parent_phone: '60127778888', grade: '高中一年级', enrolled_subjects: ['Physics', 'Chemistry', 'Add Maths'], base_fee: '240.00', status: 'Active' },
    { id: 'STU_5', student_code: 'STU2026005', name: '赵一凡', gender: 'Male', phone: '60120013805', parent_name: '赵秀兰', parent_phone: '60129990000', grade: '初中三年级', enrolled_subjects: ['Bahasa Melayu', 'Mathematics', 'Sejarah'], base_fee: '240.00', status: 'Active' }
  ],
  classes: [
    { id: 'CLS_1', class_name: '高二数学拔尖冲刺班', subject: 'Mathematics', grade: '高中二年级', teacher_name: '林老师', fee_amount: '250.00', schedule: '周六 09:00-11:30' },
    { id: 'CLS_2', class_name: '初三英语中考强化班', subject: 'English', grade: '初中三年级', teacher_name: 'Sarah 老师', fee_amount: '220.00', schedule: '周日 14:00-16:30' },
    { id: 'CLS_3', class_name: '高一物理实验与理论班', subject: 'Physics', grade: '高中一年级', teacher_name: '王教授', fee_amount: '240.00', schedule: '周五 18:30-20:30' }
  ],
  payments: [
    { id: 'PAY_1', student_id: 'STU_1', student_name: '张小明', student_code: 'STU2026001', class_name: '高二数学拔尖冲刺班', month_year: '2026-10', amount: '240.00', status: 'Paid', receipt_no: 'RCP-20261001-0101', payment_date: '2026-10-01 10:30:00' },
    { id: 'PAY_2', student_id: 'STU_2', student_name: '李思思', student_code: 'STU2026002', class_name: '初三英语中考强化班', month_year: '2026-10', amount: '240.00', status: 'Paid', receipt_no: 'RCP-20261002-0102', payment_date: '2026-10-02 14:15:00' },
    { id: 'PAY_3', student_id: 'STU_3', student_name: '王梓豪', student_code: 'STU2026003', class_name: '高二数学拔尖冲刺班', month_year: '2026-10', amount: '160.00', status: 'Unpaid', receipt_no: null, payment_date: null },
    { id: 'PAY_4', student_id: 'STU_4', student_name: '陈佳欣', student_code: 'STU2026004', class_name: '高一物理实验与理论班', month_year: '2026-10', amount: '240.00', status: 'Overdue', receipt_no: null, payment_date: null },
    { id: 'PAY_5', student_id: 'STU_5', student_name: '赵一凡', student_code: 'STU2026005', class_name: '初三英语中考强化班', month_year: '2026-10', amount: '240.00', status: 'Paid', receipt_no: 'RCP-20261004-0103', payment_date: '2026-10-04 16:00:00' }
  ],
  attendance: {
    'Mathematics_2026-10-14': {
      'STU_1': { student_id: 'STU_1', subject: 'Mathematics', attendance_date: '2026-10-14', status: 'Present', remarks: '积极发言, 思维敏捷' },
      'STU_3': { student_id: 'STU_3', subject: 'Mathematics', attendance_date: '2026-10-14', status: 'Late', remarks: '迟到15分钟, 已补发课堂笔记' },
      'STU_5': { student_id: 'STU_5', subject: 'Mathematics', attendance_date: '2026-10-14', status: 'Present', remarks: '完成作业, 课堂参与度高' }
    },
    'English_2026-10-14': {
      'STU_2': { student_id: 'STU_2', subject: 'English', attendance_date: '2026-10-14', status: 'Present', remarks: '听力测试满分, 表现优异' }
    }
  },
  materials: [
    { id: 'MAT_1', title: '2026版高二数学导数与极值突破讲义.pdf', subject: '数学', category: '讲义', class_name: '高二数学拔尖冲刺班', file_url: 'https://example.com/materials/math_derivatives_2026.pdf', uploaded_at: '2026-10-01' },
    { id: 'MAT_2', title: '初三英语中考核心词汇与语法手册.pdf', subject: '英语', category: '讲义', class_name: '初三英语中考强化班', file_url: 'https://example.com/materials/english_zk_vocab.pdf', uploaded_at: '2026-10-02' }
  ],
  notices: [
    {
      id: 'NOT_1',
      title: '2026-10月份学费缴交温馨提醒',
      type: '每月学费提醒',
      target_type: 'single',
      target_summary: '张小明 (60121112222)',
      student_id: 'STU_1',
      student_name: '张小明',
      parent_phone: '60121112222',
      content: `尊敬的张伟家长：\n您好！这里是智学补习中心。\n温馨提醒您，学员【张小明】（高中二年级）2026-10月份的学费账单已发布，学费金额为：RM 240.00。\n报读科目：Mathematics, Add Maths, Physics。\n请于本月10日前完成学费缴纳。如已完成缴费，请忽略此通知。感谢您对我们教学工作的支持与配合！`,
      created_at: '2026-10-02 10:15:00'
    }
  ]
};

// 全局应用实例 TuitionFirebaseApp
window.TuitionFirebaseApp = (function () {
  // 统一课程/科目本地缓存键名与预设科目列表
  const STORAGE_KEY_SUBJECTS = 'tuition_centre_subjects';
  const DEFAULT_SUBJECTS = [
    'Bahasa Melayu',
    'English',
    'Bahasa Cina',
    'Mathematics',
    'Add Maths',
    'Science',
    'Physics',
    'Chemistry',
    'Biology',
    'Sejarah',
    'Geografi',
    'Prinsip Perakaunan',
    'Ekonomi'
  ];

  const state = {
    subjects: [], // 统一课程/科目全局数据源 (Global Subject State)
    students: [],
    classes: [],
    payments: [],
    materials: [],
    attendanceRecords: [],
    notices: [],
    currentSubject: null,
    currentClassId: null,
    currentAttendanceDate: new Date().toISOString().slice(0, 10),
    currentNoticeAudience: [],
    unsubscribeStudents: null,
    unsubscribeClasses: null,
    unsubscribePayments: null,
    unsubscribeMaterials: null,
    unsubscribeNotices: null
  };

  // ============================================================
  // 0. 全局课程与科目状态管理 (Global Subject State & Dynamic UI)
  // ============================================================

  /**
   * 初始化全局科目/课程数据源
   * 聚合 localStorage、系统默认预设以及当前班级与学员档案中的所有科目
   */
  function initGlobalSubjects() {
    let stored = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SUBJECTS);
      if (raw) {
        stored = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('读取课程科目缓存失败:', e);
    }

    const set = new Set();
    // 1. 预设核心科目
    DEFAULT_SUBJECTS.forEach(s => {
      if (s && typeof s === 'string') set.add(s.trim());
    });
    // 2. 本地持久化保存的科目
    if (Array.isArray(stored)) {
      stored.forEach(s => {
        if (s && typeof s === 'string') set.add(s.trim());
      });
    }
    // 3. 内存班级数据中的课程科目
    if (Array.isArray(state.classes)) {
      state.classes.forEach(c => {
        if (c.subject && typeof c.subject === 'string') set.add(c.subject.trim());
      });
    }
    // 4. 学员已报读科目
    if (Array.isArray(state.students)) {
      state.students.forEach(st => {
        if (Array.isArray(st.enrolled_subjects)) {
          st.enrolled_subjects.forEach(s => {
            if (s && typeof s === 'string') set.add(s.trim());
          });
        }
      });
    }

    state.subjects = Array.from(set).filter(Boolean);
    saveGlobalSubjects();
    return state.subjects;
  }

  /**
   * 持久化当前全局课程/科目列表至 localStorage
   */
  function saveGlobalSubjects() {
    try {
      localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(state.subjects));
    } catch (e) {
      console.warn('保存课程科目缓存失败:', e);
    }
  }

  /**
   * 动态新增一个新科目至全局数据源
   * @param {string} subjectName 科目名称
   * @returns {boolean} 是否为全新添加
   */
  function addGlobalSubject(subjectName) {
    if (!subjectName || typeof subjectName !== 'string') return false;
    const trimmed = subjectName.trim();
    if (!trimmed) return false;

    const exists = state.subjects.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      state.subjects.push(trimmed);
      saveGlobalSubjects();
      return true;
    }
    return false;
  }

  /**
   * 弹窗快捷添加新科目
   */
  function promptAddNewSubject() {
    const input = prompt('请输入新开设的科目/课程名称 (例如: Computer Science, Economics):');
    if (!input) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    const added = addGlobalSubject(trimmed);
    refreshAllSubjectControls();
    if (added) {
      showToast(`已成功添加新科目【${trimmed}】并同步至所有模块！`);
    } else {
      showToast(`科目【${trimmed}】已存在于课程列表中`, 'info');
    }
  }

  /**
   * 从当前班级与学员数据源深度同步新科目
   */
  function syncGlobalSubjectsFromData() {
    let changed = false;
    if (Array.isArray(state.classes)) {
      state.classes.forEach(c => {
        if (c.subject && typeof c.subject === 'string') {
          if (addGlobalSubject(c.subject.trim())) changed = true;
        }
      });
    }
    if (Array.isArray(state.students)) {
      state.students.forEach(st => {
        if (Array.isArray(st.enrolled_subjects)) {
          st.enrolled_subjects.forEach(sub => {
            if (sub && typeof sub === 'string') {
              if (addGlobalSubject(sub.trim())) changed = true;
            }
          });
        }
      });
    }
    if (changed) {
      saveGlobalSubjects();
    }
    return changed;
  }

  /**
   * 1. 动态渲染“添加学员”弹窗中的报读科目多选框 (Checkboxes)
   */
  function renderAddStudentSubjectCheckboxes() {
    const container = document.getElementById('subjectCheckboxContainer');
    if (!container) return;

    // 保留当前已勾选的项目
    const currentlyChecked = new Set();
    container.querySelectorAll('.subject-checkbox:checked').forEach(cb => {
      currentlyChecked.add(cb.value);
    });

    if (state.subjects.length === 0) {
      container.innerHTML = `<div class="col-12 text-muted text-center py-2 small">暂无课程科目，请先在班级管理中开设课程或点击右上角“新增科目”</div>`;
      return;
    }

    container.innerHTML = state.subjects.map((sub, idx) => {
      const isChecked = currentlyChecked.has(sub);
      const inputId = `new_sub_${idx}_${sub.replace(/[^a-zA-Z0-9]/g, '_')}`;
      return `
        <div class="col-6 col-sm-4 col-md-3">
          <div class="form-check form-check-inline p-2 border rounded bg-white w-100 m-0 d-flex align-items-center">
            <input class="form-check-input subject-checkbox mt-0 me-2" type="checkbox" id="${inputId}" value="${sub}" ${isChecked ? 'checked' : ''} onchange="TuitionFirebaseApp.onSubjectSelectionChange()">
            <label class="form-check-label small fw-medium text-truncate flex-grow-1" for="${inputId}" title="${sub}">
              ${sub}
            </label>
          </div>
        </div>
      `;
    }).join('');

    onSubjectSelectionChange();
  }

  /**
   * 2. 动态渲染“编辑学员”弹窗中的报读科目多选框 (Checkboxes)
   */
  function renderEditStudentSubjectCheckboxes(enrolledList = []) {
    const container = document.getElementById('editSubjectCheckboxContainer');
    if (!container) return;

    const enrolledSet = new Set(Array.isArray(enrolledList) ? enrolledList : []);

    if (state.subjects.length === 0) {
      container.innerHTML = `<div class="col-12 text-muted text-center py-2 small">暂无课程科目</div>`;
      return;
    }

    container.innerHTML = state.subjects.map((sub, idx) => {
      const isChecked = enrolledSet.has(sub);
      const inputId = `edit_sub_${idx}_${sub.replace(/[^a-zA-Z0-9]/g, '_')}`;
      return `
        <div class="col-6 col-sm-4 col-md-3">
          <div class="form-check form-check-inline p-2 border rounded bg-white w-100 m-0 d-flex align-items-center">
            <input class="form-check-input edit-subject-checkbox mt-0 me-2" type="checkbox" id="${inputId}" value="${sub}" ${isChecked ? 'checked' : ''} onchange="TuitionFirebaseApp.onEditSubjectSelectionChange()">
            <label class="form-check-label small fw-medium text-truncate flex-grow-1" for="${inputId}" title="${sub}">
              ${sub}
            </label>
          </div>
        </div>
      `;
    }).join('');

    onEditSubjectSelectionChange();
  }

  /**
   * 3. 动态渲染“课堂点名与考勤”顶部科目下拉选择框
   */
  function renderAttendanceSubjectDropdown(preserveSelection = true) {
    const select = document.getElementById('attendanceSubjectSelect');
    if (!select) return;

    const currentVal = preserveSelection ? (select.value || state.currentSubject) : '';
    let optionsHtml = `<option value="">-- 请选择点名科目 (Select Subject) --</option>`;
    state.subjects.forEach(sub => {
      const isSelected = (currentVal && currentVal === sub) ? 'selected' : '';
      optionsHtml += `<option value="${sub}" ${isSelected}>${sub}</option>`;
    });

    select.innerHTML = optionsHtml;
    if (currentVal && state.subjects.includes(currentVal)) {
      select.value = currentVal;
    }
  }

  /**
   * 4. 动态渲染“后台通知控制台”科目筛选下拉菜单
   */
  function renderNoticeFilterSubjectDropdown(preserveSelection = true) {
    const select = document.getElementById('noticeFilterSubject');
    if (!select) return;

    const currentVal = preserveSelection ? select.value : '';
    let optionsHtml = `<option value="">所有科目</option>`;
    state.subjects.forEach(sub => {
      const isSelected = (currentVal && currentVal === sub) ? 'selected' : '';
      optionsHtml += `<option value="${sub}" ${isSelected}>${sub}</option>`;
    });

    select.innerHTML = optionsHtml;
    if (currentVal && state.subjects.includes(currentVal)) {
      select.value = currentVal;
    }
  }

  /**
   * 5. 动态渲染学员名册顶部的科目筛选下拉菜单
   */
  function renderStudentFilterSubjectDropdown(preserveSelection = true) {
    const select = document.getElementById('filterStudentSubject');
    if (!select) return;

    const currentVal = preserveSelection ? select.value : '';
    let optionsHtml = `<option value="">所有报读科目</option>`;
    state.subjects.forEach(sub => {
      const isSelected = (currentVal && currentVal === sub) ? 'selected' : '';
      optionsHtml += `<option value="${sub}" ${isSelected}>${sub}</option>`;
    });

    select.innerHTML = optionsHtml;
    if (currentVal && state.subjects.includes(currentVal)) {
      select.value = currentVal;
    }
  }

  /**
   * 6. 动态渲染教材资料上传中的科目下拉菜单
   */
  function renderMaterialSubjectDropdown() {
    const select = document.getElementById('matSubject');
    if (!select) return;
    const currentVal = select.value;
    let optionsHtml = `<option value="">-- 选择科目 --</option>`;
    state.subjects.forEach(sub => {
      const isSelected = (currentVal && currentVal === sub) ? 'selected' : '';
      optionsHtml += `<option value="${sub}" ${isSelected}>${sub}</option>`;
    });
    select.innerHTML = optionsHtml;
    if (currentVal && state.subjects.includes(currentVal)) {
      select.value = currentVal;
    }
  }

  /**
   * 7. 动态渲染开设班级中的现有科目 datalist 推荐选项
   */
  function renderClassSubjectDatalist() {
    const datalist = document.getElementById('existingSubjectsDatalist');
    if (!datalist) return;
    datalist.innerHTML = state.subjects.map(s => `<option value="${s}"></option>`).join('');
  }

  /**
   * 一键刷新所有科目关联组件 (Dynamic UI Update)
   * 确保开设新课程后，添加学员多选框、点名下拉框、通知控制台等即刻联动，无需刷新页面
   */
  function refreshAllSubjectControls(preserveSelections = true) {
    renderAddStudentSubjectCheckboxes();
    renderAttendanceSubjectDropdown(preserveSelections);
    renderNoticeFilterSubjectDropdown(preserveSelections);
    renderStudentFilterSubjectDropdown(preserveSelections);
    renderMaterialSubjectDropdown();
    renderClassSubjectDatalist();
  }

  /**
   * 自动生成电子收据凭证号 (RCP-YYYYMMDD-XXXX)
   */
  function generateReceiptNo(docId = '') {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    let suffix = '0001';
    if (docId) {
      const clean = docId.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      suffix = (clean + '8888').slice(0, 4);
    } else {
      suffix = String(Math.floor(1000 + Math.random() * 9000));
    }
    return `RCP-${dateStr}-${suffix}`;
  }

  /**
   * 金额格式化辅助函数：统一采用马来西亚令吉 RM 0.00
   */
  function formatMoney(val) {
    const num = parseFloat(val);
    return isNaN(num) ? 'RM 0.00' : `RM ${num.toFixed(2)}`;
  }

  /**
   * 获取纯数字金额
   */
  function getRawAmount(val) {
    const num = parseFloat(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  }

  /**
   * 格式化手机号码以供 WhatsApp 使用 (马来西亚 + 国际)
   */
  function formatPhoneForWhatsApp(phone) {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('01')) {
      clean = '6' + clean;
    } else if (clean.startsWith('1') && clean.length === 11) {
      clean = '86' + clean;
    }
    return clean;
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

  function switchTab(tabId) {
    const tabBtn = document.getElementById(tabId);
    if (tabBtn) {
      const triggerEl = new bootstrap.Tab(tabBtn);
      triggerEl.show();
    }
  }

  async function init() {
    console.log('TuitionFirebaseApp Initializing with Global Subject State & Notice Console...');

    // 1. 初始化全局科目并初次动态渲染所有关联控件
    initGlobalSubjects();
    refreshAllSubjectControls();

    const datePicker = document.getElementById('attendanceDatePicker');
    if (datePicker) datePicker.value = state.currentAttendanceDate;

    const monthPicker = document.getElementById('filterPaymentMonth');
    if (monthPicker) monthPicker.value = new Date().toISOString().slice(0, 7);

    const billMonthPicker = document.getElementById('billMonthYear');
    if (billMonthPicker) billMonthPicker.value = new Date().toISOString().slice(0, 7);

    if (isConfigured && auth) {
      try {
        await signInAnonymously(auth);
        updateModeBadge('Firebase Cloud Serverless 实时同步已就绪', 'success');
      } catch (authErr) {
        updateModeBadge('演示数据模式 (可通过配置 Firebase API Key 开启真实云存储)', 'warning');
      }
    } else {
      updateModeBadge('演示数据模式 (可填入 Firebase apiKey 开启 Cloud Firestore 实时同步)', 'info');
    }

    bindRealtimeSnapshotListeners();
    setupEventListeners();
    initNoticeConsole();
  }

  function updateModeBadge(text, color) {
    const badge = document.getElementById('firebaseModeBadge');
    if (badge) {
      badge.innerHTML = `<i class="bi bi-cloud-check-fill me-1"></i> ${text}`;
      badge.className = `badge bg-${color}-subtle text-${color} border border-${color}-subtle px-3 py-2`;
    }
  }

  function setupEventListeners() {
    const searchStudent = document.getElementById('searchStudentInput');
    if (searchStudent) searchStudent.addEventListener('keyup', () => filterAndRenderStudents());
    
    const filterGrade = document.getElementById('filterStudentGrade');
    if (filterGrade) filterGrade.addEventListener('change', () => filterAndRenderStudents());

    const filterSubject = document.getElementById('filterStudentSubject');
    if (filterSubject) filterSubject.addEventListener('change', () => filterAndRenderStudents());

    const searchPayment = document.getElementById('searchPaymentInput');
    if (searchPayment) searchPayment.addEventListener('keyup', () => filterAndRenderPayments());
    
    const filterMonth = document.getElementById('filterPaymentMonth');
    if (filterMonth) filterMonth.addEventListener('change', () => filterAndRenderPayments());
    
    const filterStatus = document.getElementById('filterPaymentStatus');
    if (filterStatus) filterStatus.addEventListener('change', () => filterAndRenderPayments());

    const billClassSelect = document.getElementById('billClassSelect');
    if (billClassSelect) {
      billClassSelect.addEventListener('change', (e) => {
        const classId = e.target.value;
        const selectedClass = state.classes.find(c => c.id === classId);
        if (selectedClass) {
          document.getElementById('billAmount').value = getRawAmount(selectedClass.fee_amount);
        }
      });
    }

    // 课堂点名科目与日期变更监听
    const attendSubject = document.getElementById('attendanceSubjectSelect');
    if (attendSubject) {
      attendSubject.addEventListener('change', () => loadAttendanceRollCall());
    }

    const attendDate = document.getElementById('attendanceDatePicker');
    if (attendDate) {
      attendDate.addEventListener('change', () => loadAttendanceRollCall());
    }

    // 正文字符计数监听
    const noticeContentInput = document.getElementById('noticeContentInput');
    if (noticeContentInput) {
      noticeContentInput.addEventListener('input', () => {
        updateNoticeCharCount();
      });
    }
  }

  function updateNoticeCharCount() {
    const el = document.getElementById('noticeContentInput');
    const badge = document.getElementById('noticeCharCount');
    if (el && badge) {
      badge.textContent = `${el.value.length} 字符`;
    }
  }

  // ============================================================
  // Firestore 实时监听 (Realtime Snapshots: onSnapshot)
  // ============================================================
  function bindRealtimeSnapshotListeners() {
    if (isConfigured && db) {
      // 1. 学生实时监听
      const studentsRef = collection(db, "students");
      state.unsubscribeStudents = onSnapshot(studentsRef, (snapshot) => {
        state.students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        syncGlobalSubjectsFromData();
        refreshAllSubjectControls();
        filterAndRenderStudents();
        populateStudentDropdowns(state.students);
        updateNoticeAudience();
        updateDashboardStats();
      }, () => {
        state.students = demoStore.students;
        syncGlobalSubjectsFromData();
        refreshAllSubjectControls();
        filterAndRenderStudents();
        populateStudentDropdowns(state.students);
        updateNoticeAudience();
        updateDashboardStats();
      });

      // 2. 班级实时监听 (开设新班级后实时触发更新)
      const classesRef = collection(db, "classes");
      state.unsubscribeClasses = onSnapshot(classesRef, (snapshot) => {
        state.classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        syncGlobalSubjectsFromData();
        refreshAllSubjectControls();
        populateClassDropdowns(state.classes);
        updateDashboardStats();
      }, () => {
        state.classes = demoStore.classes;
        syncGlobalSubjectsFromData();
        refreshAllSubjectControls();
        populateClassDropdowns(state.classes);
        updateDashboardStats();
      });

      // 3. 学费实时监听
      const paymentsRef = collection(db, "payments");
      state.unsubscribePayments = onSnapshot(paymentsRef, (snapshot) => {
        state.payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filterAndRenderPayments();
        updateDashboardStats();
      }, () => {
        state.payments = demoStore.payments;
        filterAndRenderPayments();
        updateDashboardStats();
      });

      // 4. 教材资料实时监听
      const materialsRef = collection(db, "materials");
      state.unsubscribeMaterials = onSnapshot(materialsRef, (snapshot) => {
        state.materials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMaterialsTable(state.materials);
      }, () => {
        state.materials = demoStore.materials;
        renderMaterialsTable(state.materials);
      });

      // 5. 通知历史实时监听
      const noticesRef = collection(db, "notices");
      state.unsubscribeNotices = onSnapshot(noticesRef, (snapshot) => {
        state.notices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderNoticeHistoryTable();
      }, () => {
        state.notices = demoStore.notices;
        renderNoticeHistoryTable();
      });

    } else {
      state.students = demoStore.students;
      state.classes = demoStore.classes;
      state.payments = demoStore.payments;
      state.materials = demoStore.materials;
      state.notices = demoStore.notices;

      syncGlobalSubjectsFromData();
      refreshAllSubjectControls();
      filterAndRenderStudents();
      populateStudentDropdowns(state.students);
      populateClassDropdowns(state.classes);
      filterAndRenderPayments();
      renderMaterialsTable(state.materials);
      renderNoticeHistoryTable();
      updateNoticeAudience();
      updateDashboardStats();
    }
  }

  function updateDashboardStats() {
    const totalStudents = state.students.filter(s => s.status !== 'Inactive').length;
    const totalClasses = state.classes.length;

    const currentMonth = new Date().toISOString().slice(0, 7);
    const paidSum = state.payments
      .filter(p => p.month_year === currentMonth && p.status === 'Paid')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

    const unpaidCount = state.payments
      .filter(p => p.month_year === currentMonth && (p.status === 'Unpaid' || p.status === 'Overdue')).length;

    document.getElementById('statTotalStudents').textContent = totalStudents;
    document.getElementById('statTotalClasses').textContent = totalClasses;
    document.getElementById('statPaidAmount').textContent = formatMoney(paidSum);
    document.getElementById('statUnpaidCount').textContent = unpaidCount;

    const recent = state.payments.slice(0, 5);
    const tbody = document.getElementById('dashboardRecentPaymentsTable');
    if (tbody) {
      if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-muted">近期无缴费记录</td></tr>`;
      } else {
        tbody.innerHTML = recent.map(p => `
          <tr>
            <td class="fw-bold">${p.student_name}</td>
            <td>${p.class_name || '补习课程'}</td>
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
    }
  }

  // ============================================================
  // 1. 学员管理与科目多选 (Student Management & Subject Selection)
  // ============================================================

  /**
   * 勾选科目后，学费金额自动根据科目数量计算并填入 (格式: RM 0.00)
   */
  function onSubjectSelectionChange() {
    const checkedBoxes = document.querySelectorAll('#subjectCheckboxContainer .subject-checkbox:checked');
    const count = checkedBoxes.length;
    const perSubjectRate = 80; // 每门科目标准 RM 80.00
    const total = count * perSubjectRate;

    const countEl = document.getElementById('selectedSubjectsCount');
    const displayEl = document.getElementById('calculatedFeeDisplay');
    const inputEl = document.getElementById('newStudentCalculatedFee');

    if (countEl) countEl.textContent = count;
    if (displayEl) displayEl.textContent = formatMoney(total);
    if (inputEl) inputEl.value = total.toFixed(2);
  }

  function filterAndRenderStudents() {
    const keyword = document.getElementById('searchStudentInput')?.value.trim().toLowerCase() || '';
    const grade = document.getElementById('filterStudentGrade')?.value || '';
    const subject = document.getElementById('filterStudentSubject')?.value || '';

    let list = state.students;
    if (grade) list = list.filter(s => s.grade === grade);
    if (subject) {
      list = list.filter(s => Array.isArray(s.enrolled_subjects) && s.enrolled_subjects.includes(subject));
    }
    if (keyword) {
      list = list.filter(s => 
        (s.name && s.name.toLowerCase().includes(keyword)) ||
        (s.student_code && s.student_code.toLowerCase().includes(keyword)) ||
        (s.phone && s.phone.includes(keyword)) ||
        (s.parent_phone && s.parent_phone.includes(keyword))
      );
    }
    renderStudentsTable(list);
  }

  function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>未找到匹配的学生记录</td></tr>`;
      return;
    }

    tbody.innerHTML = students.map(s => {
      const subjectsBadges = Array.isArray(s.enrolled_subjects) && s.enrolled_subjects.length > 0
        ? s.enrolled_subjects.map(sub => `<span class="badge bg-slate-100 text-slate-700 border me-1 mb-1">${sub}</span>`).join('')
        : '<span class="text-muted small">未报读</span>';

      const estimatedFee = s.base_fee 
        ? formatMoney(s.base_fee) 
        : (Array.isArray(s.enrolled_subjects) ? formatMoney(s.enrolled_subjects.length * 80) : 'RM 0.00');

      return `
        <tr>
          <td class="fw-bold text-primary">${s.student_code}</td>
          <td class="fw-bold">${s.name}</td>
          <td>${s.gender === 'Male' ? '<span class="badge bg-primary-subtle text-primary">男</span>' : '<span class="badge bg-danger-subtle text-danger">女</span>'}</td>
          <td><span class="badge bg-secondary-subtle text-secondary-emphasis">${s.grade}</span></td>
          <td><div class="d-flex flex-wrap">${subjectsBadges}</div></td>
          <td class="fw-bold text-dark">${estimatedFee}</td>
          <td>${s.phone || '-'}</td>
          <td>${s.parent_name || '-'}</td>
          <td><i class="bi bi-telephone-fill me-1 text-success small"></i>${s.parent_phone}</td>
          <td>
            ${s.status === 'Active' 
              ? '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check-circle-fill me-1"></i>在读</span>' 
              : '<span class="badge bg-secondary-subtle text-secondary"><i class="bi bi-dash-circle me-1"></i>离校</span>'}
          </td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" onclick="TuitionFirebaseApp.openEditStudentModal('${s.id}')" title="编辑学员档案及科目">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button class="btn btn-outline-primary" onclick="TuitionFirebaseApp.quickCreateBillForStudent('${s.id}')">
                <i class="bi bi-receipt me-1"></i>开账单
              </button>
              <button class="btn btn-outline-success" onclick="TuitionFirebaseApp.openSingleNoticeForStudent('${s.id}')" title="发送通知">
                <i class="bi bi-whatsapp"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function populateStudentDropdowns(students) {
    const billSelect = document.getElementById('billStudentSelect');
    if (billSelect) {
      billSelect.innerHTML = `<option value="">-- 请选择学生 --</option>` +
        students.map(s => `<option value="${s.id}">${s.name} (${s.student_code} - ${s.grade})</option>`).join('');
    }

    const noticeStudentSelect = document.getElementById('noticeStudentSelect');
    if (noticeStudentSelect) {
      const prevVal = noticeStudentSelect.value;
      noticeStudentSelect.innerHTML = `<option value="">-- 请选择学员 --</option>` +
        students.map(s => `<option value="${s.id}">${s.name} (${s.student_code} - ${s.grade})</option>`).join('');
      if (prevVal) noticeStudentSelect.value = prevVal;
    }
  }

  async function submitAddStudent(e) {
    e.preventDefault();
    const student_code = document.getElementById('newStudentCode').value.trim() || `STU${Date.now().toString().slice(-7)}`;
    const name = document.getElementById('newStudentName').value.trim();
    const gender = document.getElementById('newStudentGender').value;
    const grade = document.getElementById('newStudentGrade').value;
    const phone = document.getElementById('newStudentPhone').value.trim();
    const parent_name = document.getElementById('newStudentParentName').value.trim();
    const parent_phone = document.getElementById('newStudentParentPhone').value.trim();

    const checkedBoxes = document.querySelectorAll('#subjectCheckboxContainer .subject-checkbox:checked');
    const enrolled_subjects = Array.from(checkedBoxes).map(cb => cb.value);

    if (enrolled_subjects.length === 0) {
      showToast('请至少勾选一门报读科目！', 'warning');
      return;
    }

    const base_fee = (enrolled_subjects.length * 80).toFixed(2);

    const studentData = {
      student_code,
      name,
      gender,
      grade,
      phone,
      parent_name,
      parent_phone,
      enrolled_subjects,
      base_fee,
      status: 'Active',
      created_at: new Date().toISOString()
    };

    try {
      if (isConfigured && db) {
        await addDoc(collection(db, "students"), studentData);
      } else {
        const newId = `STU_${Date.now()}`;
        state.students.unshift({ id: newId, ...studentData });
        filterAndRenderStudents();
        populateStudentDropdowns(state.students);
        updateNoticeAudience();
        updateDashboardStats();
      }

      // 同步全局科目状态并重新刷新
      enrolled_subjects.forEach(sub => addGlobalSubject(sub));
      refreshAllSubjectControls();

      showToast(`成功录入学员【${name}】！报读 ${enrolled_subjects.length} 门科目，学费: RM ${base_fee}`);
      document.getElementById('addStudentForm').reset();
      onSubjectSelectionChange();
      const modal = bootstrap.Modal.getInstance(document.getElementById('addStudentModal'));
      if (modal) modal.hide();
    } catch (err) {
      showToast("添加学生失败: " + err.message, "error");
    }
  }

  /**
   * 编辑学员弹窗中科目勾选联动更新学费
   */
  function onEditSubjectSelectionChange() {
    const checkedBoxes = document.querySelectorAll('#editSubjectCheckboxContainer .edit-subject-checkbox:checked');
    const count = checkedBoxes.length;
    const perSubjectRate = 80;
    const total = count * perSubjectRate;

    const countEl = document.getElementById('editSelectedSubjectsCount');
    const displayEl = document.getElementById('editCalculatedFeeDisplay');
    const inputEl = document.getElementById('editStudentCalculatedFee');

    if (countEl) countEl.textContent = count;
    if (displayEl) displayEl.textContent = formatMoney(total);
    if (inputEl) inputEl.value = total.toFixed(2);
  }

  /**
   * 打开编辑学生弹窗并动态填充科目及资料
   */
  function openEditStudentModal(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) {
      showToast('未找到该学员档案', 'error');
      return;
    }

    document.getElementById('editStudentDocId').value = student.id;
    document.getElementById('editStudentCode').value = student.student_code || '';
    document.getElementById('editStudentName').value = student.name || '';
    document.getElementById('editStudentGender').value = student.gender || 'Male';
    document.getElementById('editStudentGrade').value = student.grade || '初中一年级';
    document.getElementById('editStudentPhone').value = student.phone || '';
    document.getElementById('editStudentParentName').value = student.parent_name || '';
    document.getElementById('editStudentParentPhone').value = student.parent_phone || '';
    document.getElementById('editStudentStatus').value = student.status || 'Active';

    renderEditStudentSubjectCheckboxes(student.enrolled_subjects || []);

    const modalEl = document.getElementById('editStudentModal');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  /**
   * 提交保存学员档案与修改后的报读科目
   */
  async function submitEditStudent(e) {
    e.preventDefault();
    const docId = document.getElementById('editStudentDocId').value;
    if (!docId) return;

    const name = document.getElementById('editStudentName').value.trim();
    const gender = document.getElementById('editStudentGender').value;
    const grade = document.getElementById('editStudentGrade').value;
    const phone = document.getElementById('editStudentPhone').value.trim();
    const parent_name = document.getElementById('editStudentParentName').value.trim();
    const parent_phone = document.getElementById('editStudentParentPhone').value.trim();
    const status = document.getElementById('editStudentStatus').value;

    const checkedBoxes = document.querySelectorAll('#editSubjectCheckboxContainer .edit-subject-checkbox:checked');
    const enrolled_subjects = Array.from(checkedBoxes).map(cb => cb.value);

    if (enrolled_subjects.length === 0) {
      showToast('请至少为学员勾选一门报读科目！', 'warning');
      return;
    }

    const base_fee = (enrolled_subjects.length * 80).toFixed(2);

    const updateData = {
      name,
      gender,
      grade,
      phone,
      parent_name,
      parent_phone,
      status,
      enrolled_subjects,
      base_fee,
      updated_at: new Date().toISOString()
    };

    try {
      if (isConfigured && db) {
        await updateDoc(doc(db, "students", docId), updateData);
      } else {
        const idx = state.students.findIndex(s => s.id === docId);
        if (idx !== -1) {
          state.students[idx] = { ...state.students[idx], ...updateData };
          filterAndRenderStudents();
          populateStudentDropdowns(state.students);
          updateNoticeAudience();
          updateDashboardStats();
        }
      }

      enrolled_subjects.forEach(sub => addGlobalSubject(sub));
      refreshAllSubjectControls();

      showToast(`成功更新学员【${name}】的档案及报读科目！`);
      const modal = bootstrap.Modal.getInstance(document.getElementById('editStudentModal'));
      if (modal) modal.hide();
    } catch (err) {
      showToast("更新学生资料失败: " + err.message, "error");
    }
  }

  /**
   * 导出学员名册 (CSV / Excel) 包含“报读科目”与“预估每月学费 (RM)”
   */
  function exportStudentsToCSV() {
    const list = state.students || [];
    if (list.length === 0) {
      showToast('暂无学员数据可供导出', 'warning');
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "学号,学生姓名,性别,年级,报读科目,预估每月学费 (RM),学生电话,家长姓名,家长联系电话,在读状态\n";

    let totalEstimatedFee = 0;

    list.forEach(s => {
      const subjectsStr = Array.isArray(s.enrolled_subjects) ? s.enrolled_subjects.join("; ") : '';
      const feeNum = s.base_fee ? parseFloat(s.base_fee) : (Array.isArray(s.enrolled_subjects) ? s.enrolled_subjects.length * 80 : 0);
      if (s.status === 'Active') {
        totalEstimatedFee += feeNum;
      }

      const row = [
        `"${s.student_code || ''}"`,
        `"${s.name || ''}"`,
        `"${s.gender === 'Male' ? '男' : '女'}"`,
        `"${s.grade || ''}"`,
        `"${subjectsStr}"`,
        `"RM ${feeNum.toFixed(2)}"`,
        `"${s.phone || ''}"`,
        `"${s.parent_name || ''}"`,
        `"${s.parent_phone || ''}"`,
        `"${s.status === 'Active' ? '在读' : '离校'}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    csvContent += `,,,,实收学费总计 (RM),"RM ${totalEstimatedFee.toFixed(2)}",,,,\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Student_Enrolment_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("学员花名册已成功导出！包含报读科目与 (RM) 格式学费");
  }

  // ============================================================
  // 2. 后台通知控制台 (Admin Notice Console)
  // ============================================================

  function initNoticeConsole() {
    applyNoticeTemplate();
    updateNoticeAudience();
  }

  /**
   * 切换接收对象类型 (All / Filter / Single)
   */
  function onNoticeTargetTypeChange() {
    const selectedRadio = document.querySelector('input[name="noticeTargetType"]:checked');
    const targetType = selectedRadio ? selectedRadio.value : 'all';

    const filterControls = document.getElementById('noticeFilterControls');
    const singleControls = document.getElementById('noticeSingleControls');

    if (filterControls) {
      filterControls.classList.toggle('d-none', targetType !== 'filter');
    }
    if (singleControls) {
      singleControls.classList.toggle('d-none', targetType !== 'single');
    }

    updateNoticeAudience();
    applyNoticeTemplate();
  }

  /**
   * 根据当前接收对象配置，动态计算匹配受众
   */
  function updateNoticeAudience() {
    const selectedRadio = document.querySelector('input[name="noticeTargetType"]:checked');
    const targetType = selectedRadio ? selectedRadio.value : 'all';

    let matched = state.students.filter(s => s.status === 'Active');

    if (targetType === 'filter') {
      const grade = document.getElementById('noticeFilterGrade')?.value || '';
      const subject = document.getElementById('noticeFilterSubject')?.value || '';
      if (grade) matched = matched.filter(s => s.grade === grade);
      if (subject) matched = matched.filter(s => Array.isArray(s.enrolled_subjects) && s.enrolled_subjects.includes(subject));
    } else if (targetType === 'single') {
      const studentId = document.getElementById('noticeStudentSelect')?.value;
      if (studentId) {
        matched = matched.filter(s => s.id === studentId);
      } else {
        matched = [];
      }
    }

    state.currentNoticeAudience = matched;

    // 更新受众数字徽章
    const badge = document.getElementById('noticeAudienceCountBadge');
    const countEl = document.getElementById('noticeAudienceCount');
    if (badge) badge.textContent = `匹配受众: ${matched.length} 人`;
    if (countEl) countEl.textContent = matched.length;

    renderNoticeAudiencePreviewTable(matched);
  }

  function renderNoticeAudiencePreviewTable(audienceList) {
    const tbody = document.getElementById('noticeAudiencePreviewTable');
    if (!tbody) return;

    if (audienceList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">无匹配接收学员</td></tr>`;
      return;
    }

    tbody.innerHTML = audienceList.map(s => `
      <tr>
        <td class="fw-bold">${s.name}</td>
        <td><span class="badge bg-slate-100 text-slate-700 border">${s.grade}</span></td>
        <td><small class="text-muted">${s.parent_phone}</small></td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-success py-0 px-2" onclick="TuitionFirebaseApp.sendNoticeViaWhatsAppForStudent('${s.id}')" title="立即发送 WhatsApp">
            <i class="bi bi-whatsapp"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  function onNoticeStudentSelected() {
    const studentId = document.getElementById('noticeStudentSelect')?.value;
    const detailBox = document.getElementById('noticeStudentDetailInfo');
    const student = state.students.find(s => s.id === studentId);

    if (student && detailBox) {
      const subs = Array.isArray(student.enrolled_subjects) ? student.enrolled_subjects.join(', ') : '未报读';
      const fee = student.base_fee ? formatMoney(student.base_fee) : 'RM 0.00';
      detailBox.innerHTML = `
        <div class="p-2 bg-white rounded border">
          <div>家长电话: <strong class="text-dark">${student.parent_phone}</strong> (${student.parent_name || '家长'})</div>
          <div>报读科目: <span class="text-primary">${subs}</span> | 预估学费: <strong class="text-dark">${fee}</strong></div>
        </div>
      `;
      detailBox.classList.remove('d-none');
    } else if (detailBox) {
      detailBox.classList.add('d-none');
    }

    updateNoticeAudience();
    applyNoticeTemplate();
  }

  /**
   * 应用消息模板并进行动态变量替换
   */
  function applyNoticeTemplate() {
    const templateKey = document.getElementById('noticeTemplateSelect')?.value || 'monthly_fee';
    const templateObj = NOTICE_TEMPLATES[templateKey] || NOTICE_TEMPLATES.monthly_fee;

    // 获取当前重点对应的学员（如果是单发，或者受众列表中的第一位，用作预览）
    const student = state.currentNoticeAudience.length > 0 ? state.currentNoticeAudience[0] : null;

    const replacedTitle = replaceNoticeVariables(templateObj.title, student);
    const replacedContent = replaceNoticeVariables(templateObj.content, student);

    const titleInput = document.getElementById('noticeTitleInput');
    const contentInput = document.getElementById('noticeContentInput');

    if (titleInput) titleInput.value = replacedTitle;
    if (contentInput) {
      contentInput.value = replacedContent;
      updateNoticeCharCount();
    }
  }

  /**
   * 动态变量替换引擎
   */
  function replaceNoticeVariables(templateText, student) {
    if (!templateText) return '';
    const now = new Date();
    const monthStr = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    const dateStr = now.toISOString().slice(0, 10);

    const studentName = student ? student.name : '各位同学';
    const parentName = student ? (student.parent_name || '各位') : '各位';
    const grade = student ? student.grade : '全中心';
    const subjects = student && Array.isArray(student.enrolled_subjects) && student.enrolled_subjects.length > 0
      ? student.enrolled_subjects.join(', ')
      : '常规补习科目';

    let feeAmount = 'RM 0.00';
    if (student) {
      const unpaidPayment = state.payments.find(p => p.student_id === student.id && (p.status === 'Unpaid' || p.status === 'Overdue'));
      if (unpaidPayment) {
        feeAmount = formatMoney(unpaidPayment.amount);
      } else if (student.base_fee) {
        feeAmount = formatMoney(student.base_fee);
      } else if (Array.isArray(student.enrolled_subjects)) {
        feeAmount = formatMoney(student.enrolled_subjects.length * 80);
      }
    }

    return templateText
      .replace(/{student_name}/g, studentName)
      .replace(/{parent_name}/g, parentName)
      .replace(/{grade}/g, grade)
      .replace(/{subjects}/g, subjects)
      .replace(/{fee_amount}/g, feeAmount)
      .replace(/{month}/g, monthStr)
      .replace(/{date}/g, dateStr)
      .replace(/{centre_name}/g, '智学补习中心')
      .replace(/{holiday_date}/g, '下周一')
      .replace(/{resume_date}/g, '下下周一')
      .replace(/{adjusted_course}/g, subjects.split(',')[0] || '补习核心课程')
      .replace(/{new_schedule}/g, '本周日 14:00-16:00')
      .replace(/{exam_date}/g, '本月25日')
      .replace(/{recent_performance}/g, '课堂专注度高，解题逻辑清晰，作业认真按时完成');
  }

  /**
   * 在光标处快捷追加插入变量标签
   */
  function insertVariableToNotice(varName) {
    const el = document.getElementById('noticeContentInput');
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const text = el.value;
    el.value = text.substring(0, start) + varName + text.substring(end);
    el.focus();
    el.selectionStart = el.selectionEnd = start + varName.length;
    updateNoticeCharCount();
  }

  /**
   * 动作按钮 1: 复制文本
   */
  async function copyNoticeContent() {
    const content = document.getElementById('noticeContentInput')?.value || '';
    if (!content) {
      showToast('通知内容为空', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      showToast('通知文本已成功复制到剪贴板！');
    } catch {
      showToast('复制失败，请手动选择复制', 'error');
    }
  }

  /**
   * 动作按钮 2: WhatsApp 直达
   */
  function sendNoticeViaWhatsApp() {
    const content = document.getElementById('noticeContentInput')?.value || '';
    if (!content) {
      showToast('通知正文为空，请先编写通知', 'warning');
      return;
    }

    if (state.currentNoticeAudience.length === 0) {
      showToast('当前未匹配到接收学员，请调整筛选条件', 'warning');
      return;
    }

    const firstStudent = state.currentNoticeAudience[0];
    sendNoticeViaWhatsAppForStudent(firstStudent.id);
  }

  /**
   * 为指定单个学员一键发起 WhatsApp 直达
   */
  function sendNoticeViaWhatsAppForStudent(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) {
      showToast('未找到该学员数据', 'error');
      return;
    }

    if (!student.parent_phone) {
      showToast(`学员【${student.name}】未登记家长联系电话`, 'warning');
      return;
    }

    // 获取当前编辑框中的文本，若是包含变量或根据该学生重新套用
    const templateKey = document.getElementById('noticeTemplateSelect')?.value || 'monthly_fee';
    const templateObj = NOTICE_TEMPLATES[templateKey] || NOTICE_TEMPLATES.monthly_fee;
    
    // 如果编辑框内有自定义修改，用编辑框作为基础替换，否则直接使用模板替换
    const rawContent = document.getElementById('noticeContentInput')?.value || templateObj.content;
    const personalizedContent = replaceNoticeVariables(rawContent, student);

    const cleanPhone = formatPhoneForWhatsApp(student.parent_phone);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(personalizedContent)}`;

    window.open(waUrl, '_blank');
    showToast(`正在为您直达【${student.name}】家长的 WhatsApp...`);
  }

  /**
   * 从学员表格中快捷打开单发通知
   */
  function openSingleNoticeForStudent(studentId) {
    switchTab('notices-tab');
    const targetSingleRadio = document.getElementById('targetSingle');
    if (targetSingleRadio) {
      targetSingleRadio.checked = true;
      onNoticeTargetTypeChange();
    }
    const select = document.getElementById('noticeStudentSelect');
    if (select) {
      select.value = studentId;
      onNoticeStudentSelected();
    }
  }

  /**
   * 动作按钮 3: 保存至历史记录
   */
  async function saveNoticeRecord() {
    const title = document.getElementById('noticeTitleInput')?.value.trim();
    const content = document.getElementById('noticeContentInput')?.value.trim();
    const templateKey = document.getElementById('noticeTemplateSelect')?.value || 'monthly_fee';
    const selectedRadio = document.querySelector('input[name="noticeTargetType"]:checked');
    const targetType = selectedRadio ? selectedRadio.value : 'all';

    if (!title || !content) {
      showToast('通知标题和通知正文不能为空！', 'warning');
      return;
    }

    let targetSummary = '全中心在读学员广播';
    if (targetType === 'single') {
      const studentId = document.getElementById('noticeStudentSelect')?.value;
      const s = state.students.find(item => item.id === studentId);
      targetSummary = s ? `${s.name} (${s.parent_phone})` : '指定学员';
    } else if (targetType === 'filter') {
      const g = document.getElementById('noticeFilterGrade')?.value || '全学段';
      const sub = document.getElementById('noticeFilterSubject')?.value || '全科目';
      targetSummary = `筛选: ${g} / ${sub} (${state.currentNoticeAudience.length}人)`;
    }

    const typeNames = {
      monthly_fee: '每月学费提醒',
      overdue_fee: '逾期催缴',
      holiday: '假期停课',
      reschedule: '临时调课',
      exam: '考试安排',
      feedback: '一对一课堂反馈'
    };

    const recordData = {
      title,
      type: typeNames[templateKey] || '常规通知',
      target_type: targetType,
      target_summary: targetSummary,
      content,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };

    try {
      if (isConfigured && db) {
        await addDoc(collection(db, "notices"), recordData);
      } else {
        const newId = `NOT_${Date.now()}`;
        state.notices.unshift({ id: newId, ...recordData });
        renderNoticeHistoryTable();
      }

      showToast('通知已成功保存至历史记录！');
    } catch (err) {
      showToast('保存历史记录失败: ' + err.message, 'error');
    }
  }

  function renderNoticeHistoryTable() {
    const tbody = document.getElementById('noticeHistoryTableBody');
    if (!tbody) return;

    if (!state.notices || state.notices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">暂无历史通知记录</td></tr>`;
      return;
    }

    tbody.innerHTML = state.notices.map(n => `
      <tr>
        <td class="small text-muted">${n.created_at ? n.created_at.substring(5, 16) : '-'}</td>
        <td><span class="badge bg-primary-subtle text-primary">${n.type}</span></td>
        <td class="small fw-semibold text-truncate" style="max-width: 140px;" title="${n.target_summary}">${n.target_summary}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary py-0 px-2" onclick="TuitionFirebaseApp.openNoticeDetailModal('${n.id}')" title="查看详情">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-danger py-0 px-2" onclick="TuitionFirebaseApp.deleteNoticeRecord('${n.id}')" title="删除">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function openNoticeDetailModal(noticeId) {
    const n = state.notices.find(item => item.id === noticeId);
    if (!n) return;

    document.getElementById('detailNoticeType').textContent = n.type;
    document.getElementById('detailNoticeTime').textContent = n.created_at;
    document.getElementById('detailNoticeTitle').textContent = n.title;
    document.getElementById('detailNoticeTarget').textContent = n.target_summary;
    document.getElementById('detailNoticeContent').textContent = n.content;

    const copyBtn = document.getElementById('detailCopyBtn');
    if (copyBtn) {
      copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(n.content);
        showToast('已复制历史通知内容！');
      };
    }

    const waBtn = document.getElementById('detailWhatsAppBtn');
    if (waBtn) {
      waBtn.onclick = () => {
        const cleanPhone = formatPhoneForWhatsApp(n.parent_phone || '');
        const waUrl = cleanPhone 
          ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(n.content)}`
          : `https://wa.me/?text=${encodeURIComponent(n.content)}`;
        window.open(waUrl, '_blank');
      };
    }

    const modal = new bootstrap.Modal(document.getElementById('noticeDetailModal'));
    modal.show();
  }

  async function deleteNoticeRecord(noticeId) {
    if (!confirm('确定要删除这条通知历史记录吗？')) return;

    try {
      if (isConfigured && db) {
        await deleteDoc(doc(db, "notices", noticeId));
      } else {
        state.notices = state.notices.filter(item => item.id !== noticeId);
        renderNoticeHistoryTable();
      }
      showToast('通知记录已删除');
    } catch (err) {
      showToast('删除失败: ' + err.message, 'error');
    }
  }

  function clearAllNoticesConfirm() {
    if (!confirm('确定要清空全部通知历史记录吗？')) return;
    if (isConfigured && db) {
      state.notices.forEach(n => {
        deleteDoc(doc(db, "notices", n.id)).catch(() => {});
      });
    } else {
      state.notices = [];
      renderNoticeHistoryTable();
    }
    showToast('通知历史记录已清空');
  }

  // ============================================================
  // 3. 班级管理 (Classes)
  // ============================================================
  function populateClassDropdowns(classes) {
    const billSelect = document.getElementById('billClassSelect');
    const matSelect = document.getElementById('matClassSelect');

    const options = classes.map(c => 
      `<option value="${c.id}">${c.class_name} [${c.subject} - ${formatMoney(c.fee_amount)}]</option>`
    ).join('');

    if (billSelect) billSelect.innerHTML = `<option value="">-- 选择班级 (自动读取标准学费) --</option>` + options;
    if (matSelect) matSelect.innerHTML = `<option value="">-- 全员通用资料 --</option>` + options;
  }

  async function submitAddClass(e) {
    e.preventDefault();
    const class_name = document.getElementById('newClassName').value.trim();
    const subject = document.getElementById('newClassSubject').value.trim();
    const grade = document.getElementById('newClassGrade').value.trim();
    const teacher_name = document.getElementById('newClassTeacher').value.trim();
    const fee_amount = getRawAmount(document.getElementById('newClassFee').value);
    const schedule = document.getElementById('newClassSchedule').value.trim();

    if (!subject) {
      showToast('请输入课程科目名称', 'warning');
      return;
    }

    // 统一课程数据源：自动同步新科目至全局状态与本地持久化
    addGlobalSubject(subject);

    const classData = { class_name, subject, grade, teacher_name, fee_amount, schedule, created_at: new Date().toISOString() };

    try {
      if (isConfigured && db) {
        await addDoc(collection(db, "classes"), classData);
      } else {
        const newId = `CLS_${Date.now()}`;
        state.classes.push({ id: newId, ...classData });
        populateClassDropdowns(state.classes);
        updateDashboardStats();
      }

      // 页面无刷新动态渲染：一键同步更新添加/编辑学员多选框、点名科目下拉框及通知控制台筛选
      refreshAllSubjectControls();

      showToast(`成功开设新班级【${class_name}】并同步至所有科目选择控件！`);
      document.getElementById('addClassForm').reset();
      const modal = bootstrap.Modal.getInstance(document.getElementById('addClassModal'));
      if (modal) modal.hide();
    } catch (err) {
      showToast("创建班级失败: " + err.message, "error");
    }
  }

  // ============================================================
  // 4. 课堂点名考勤与批量提交 (Attendance & WriteBatch - Subject Based)
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
    const date = (datePicker && datePicker.value) ? datePicker.value : state.currentAttendanceDate;
    state.currentSubject = selectedSubject;
    state.currentAttendanceDate = date;

    // 动态联动：仅展示【已报读该科目】的在读学员名单
    const enrolledStudents = state.students.filter(s => {
      if (s.status === 'Inactive') return false;
      if (!s.enrolled_subjects) return false;
      if (Array.isArray(s.enrolled_subjects)) {
        return s.enrolled_subjects.includes(selectedSubject);
      }
      if (typeof s.enrolled_subjects === 'string') {
        return s.enrolled_subjects.split(',').map(x => x.trim()).includes(selectedSubject);
      }
      return false;
    });

    if (badgeEl) {
      badgeEl.innerHTML = `<i class="bi bi-people me-1"></i> 已报读: ${enrolledStudents.length} 人`;
    }
    if (summaryEl) {
      summaryEl.innerHTML = `<i class="bi bi-bookmark-check-fill text-primary me-1"></i>当前正在点名：<strong class="text-dark">${selectedSubject}</strong>（${date}），已匹配到 ${enrolledStudents.length} 名报读学员`;
    }

    if (enrolledStudents.length === 0) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-exclamation-circle text-warning me-1"></i>当前科目【${selectedSubject}】暂无已报读学员，请前往学员档案进行科目勾选录入</td></tr>`;
      }
      return;
    }

    let logsMap = {};
    if (isConfigured && db) {
      try {
        const attQuery = query(
          collection(db, "attendance"),
          where("subject", "==", selectedSubject),
          where("attendance_date", "==", date)
        );
        const snapshot = await getDocs(attQuery);
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          logsMap[data.student_id] = { docId: docSnap.id, ...data };
        });
      } catch (err) {
        console.warn("Query attendance error:", err);
      }
    } else {
      const key = `${selectedSubject}_${date}`;
      logsMap = demoStore.attendance[key] || {};
    }

    renderAttendanceTable(enrolledStudents, logsMap, selectedSubject);
  }

  function renderAttendanceTable(students, logsMap = {}, currentSubject = '') {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    if (students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-exclamation-circle text-warning me-1"></i>当前科目暂无已报读学员</td></tr>`;
      return;
    }

    const quickTags = ['积极发言', '完成作业', '思维敏捷', '解题规范', '基础扎实', '迟到15分钟', '注意力集中', '需个别辅导'];

    tbody.innerHTML = students.map(s => {
      const existingLog = logsMap[s.id] || {};
      const currentStatus = existingLog.status || 'Present';
      const currentRemarks = existingLog.remarks || '';

      const subjectsArr = Array.isArray(s.enrolled_subjects) 
        ? s.enrolled_subjects 
        : (typeof s.enrolled_subjects === 'string' ? s.enrolled_subjects.split(',').map(x => x.trim()) : []);

      const subjectBadges = subjectsArr.map(sub => {
        if (sub === currentSubject) {
          return `<span class="badge bg-primary text-white me-1 mb-1 shadow-sm"><i class="bi bi-check-lg me-1"></i>${sub}</span>`;
        }
        return `<span class="badge bg-light text-secondary border me-1 mb-1">${sub}</span>`;
      }).join('');

      return `
        <tr data-student-id="${s.id}" data-log-id="${existingLog.docId || ''}">
          <td class="fw-bold text-secondary">${s.student_code}</td>
          <td class="fw-bold fs-6 text-dark">${s.name}</td>
          <td><span class="badge bg-light text-dark border">${s.grade}</span></td>
          <td style="max-width: 220px;">${subjectBadges || '<span class="text-muted small">未设置</span>'}</td>
          <td>
            <div class="btn-group btn-group-sm" role="group">
              <input type="radio" class="btn-check" name="status_${s.id}" id="att_present_${s.id}" value="Present" ${currentStatus === 'Present' ? 'checked' : ''}>
              <label class="btn btn-outline-success" for="att_present_${s.id}"><i class="bi bi-circle-fill text-success me-1"></i>出席</label>

              <input type="radio" class="btn-check" name="status_${s.id}" id="att_late_${s.id}" value="Late" ${currentStatus === 'Late' ? 'checked' : ''}>
              <label class="btn btn-outline-warning" for="att_late_${s.id}"><i class="bi bi-exclamation-circle text-warning me-1"></i>迟到</label>

              <input type="radio" class="btn-check" name="status_${s.id}" id="att_absent_${s.id}" value="Absent" ${currentStatus === 'Absent' ? 'checked' : ''}>
              <label class="btn btn-outline-danger" for="att_absent_${s.id}"><i class="bi bi-x-circle text-danger me-1"></i>缺席</label>

              <input type="radio" class="btn-check" name="status_${s.id}" id="att_excused_${s.id}" value="Excused" ${currentStatus === 'Excused' ? 'checked' : ''}>
              <label class="btn btn-outline-secondary" for="att_excused_${s.id}"><i class="bi bi-person-exclamation me-1"></i>请假</label>
            </div>
          </td>
          <td>
            <div class="mb-1 d-flex flex-wrap gap-1">
              ${quickTags.map(tag => `
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle tag-btn" 
                      style="cursor: pointer;"
                      onclick="TuitionFirebaseApp.appendRemarkTag('${s.id}', '${tag}')">
                  <i class="bi bi-pencil-square me-1"></i>${tag}
                </span>
              `).join('')}
            </div>
            <input type="text" id="remark_input_${s.id}" class="form-control form-control-sm rounded-2 mt-1" 
                   value="${currentRemarks}" placeholder="添加评价或备注...">
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
    radios.forEach(r => { r.checked = true; });
    showToast(`已将【${state.currentSubject || '当前科目'}】名册学员一键设为【出席】！`);
  }

  function appendRemarkTag(studentId, tagText) {
    const input = document.getElementById(`remark_input_${studentId}`);
    if (!input) return;
    const currentVal = input.value.trim();
    if (!currentVal) {
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
      showToast('当前科目名册无有效学员可提交', 'warning');
      return;
    }

    try {
      if (isConfigured && db) {
        const batch = writeBatch(db);
        rows.forEach(row => {
          const studentId = row.getAttribute('data-student-id');
          const docId = row.getAttribute('data-log-id');
          const selectedStatus = row.querySelector(`input[name="status_${studentId}"]:checked`)?.value || 'Present';
          const remarks = document.getElementById(`remark_input_${studentId}`)?.value.trim() || '';

          const recordData = {
            student_id: studentId,
            subject: subject,
            attendance_date: date,
            status: selectedStatus,
            remarks: remarks,
            updated_at: new Date().toISOString()
          };

          if (docId) {
            const docRef = doc(db, "attendance", docId);
            batch.update(docRef, recordData);
          } else {
            const newRef = doc(collection(db, "attendance"));
            batch.set(newRef, recordData);
          }
        });

        await batch.commit();
        showToast(`成功通过 WriteBatch 将【${subject}】${rows.length} 笔考勤保存至 Firestore！`);
      } else {
        const key = `${subject}_${date}`;
        if (!demoStore.attendance[key]) demoStore.attendance[key] = {};

        rows.forEach(row => {
          const studentId = row.getAttribute('data-student-id');
          const selectedStatus = row.querySelector(`input[name="status_${studentId}"]:checked`)?.value || 'Present';
          const remarks = document.getElementById(`remark_input_${studentId}`)?.value.trim() || '';
          demoStore.attendance[key][studentId] = { 
            student_id: studentId, 
            subject: subject,
            attendance_date: date,
            status: selectedStatus, 
            remarks,
            updated_at: new Date().toISOString()
          };
        });

        showToast(`成功保存【${subject}】${rows.length} 位学员的考勤评价至记录！`);
      }

      await loadAttendanceRollCall();
    } catch (err) {
      showToast("批量提交考勤失败: " + err.message, "error");
    }
  }

  // ============================================================
  // 5. 学费管理 & Excel 导出 (Payments Firestore Operations & CSV Export)
  // ============================================================
  function filterAndRenderPayments() {
    const month = document.getElementById('filterPaymentMonth')?.value || '';
    const status = document.getElementById('filterPaymentStatus')?.value || '';
    const keyword = document.getElementById('searchPaymentInput')?.value.trim().toLowerCase() || '';

    let list = state.payments;
    if (month) list = list.filter(p => p.month_year === month);
    if (status) list = list.filter(p => p.status === status);
    if (keyword) {
      list = list.filter(p => 
        (p.student_name && p.student_name.toLowerCase().includes(keyword)) ||
        (p.receipt_no && p.receipt_no.toLowerCase().includes(keyword))
      );
    }

    renderPaymentsTable(list);
  }

  function renderPaymentsTable(payments) {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    if (payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>暂无符合条件的学费记录</td></tr>`;
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
          <td class="fw-bold text-secondary">#${p.id.slice(-6)}</td>
          <td class="fw-bold">${p.student_name} <span class="small text-muted">(${p.student_code || ''})</span></td>
          <td>${p.class_name || '补习课程'}</td>
          <td><span class="badge bg-light text-dark border">${p.month_year}</span></td>
          <td class="fw-bold text-dark fs-6">${formattedAmt}</td>
          <td>${statusBadge}</td>
          <td>
            ${p.receipt_no 
              ? `<code class="fw-bold text-primary bg-light px-2 py-1 rounded">${p.receipt_no}</code>` 
              : `<span class="text-muted small">未派发</span>`}
          </td>
          <td class="small text-muted">${p.payment_date ? p.payment_date.substring(0, 16) : '-'}</td>
          <td class="text-center">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="TuitionFirebaseApp.openUpdatePaymentModal('${p.id}', '${p.student_name}', '${p.month_year}', '${p.status}', '${rawAmt}')">
                <i class="bi bi-pencil-square me-1"></i>改状态
              </button>
              ${isPaid 
                ? `<button class="btn btn-success" onclick="TuitionFirebaseApp.openReceiptModal('${p.id}')"><i class="bi bi-printer me-1"></i>收据凭证</button>` 
                : `<button class="btn btn-outline-success" onclick="TuitionFirebaseApp.quickSetPaid('${p.id}')"><i class="bi bi-check-circle me-1"></i>设为已缴</button>`}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * 导出 Excel (CSV) 报表功能
   * 表头明确标示“学费金额 (RM)”，底部汇总行标示“实收学费总计 (RM)”
   */
  function exportPaymentsToCSV() {
    const payments = state.payments || [];
    if (payments.length === 0) {
      showToast('暂无学费记录可供导出', 'warning');
      return;
    }

    let csvContent = "\uFEFF"; // BOM UTF-8
    csvContent += "账单编号,学生姓名,学号,关联班级/科目,报读科目,账单月份,学费金额 (RM),支付状态,电子收据单号,付款日期\n";

    let totalPaidRM = 0;

    payments.forEach(p => {
      const amt = parseFloat(p.amount || 0);
      if (p.status === 'Paid') {
        totalPaidRM += amt;
      }

      const student = state.students.find(s => s.id === p.student_id);
      const subjectsStr = student && Array.isArray(student.enrolled_subjects) ? student.enrolled_subjects.join("; ") : '';

      const row = [
        `"${p.id || ''}"`,
        `"${p.student_name || ''}"`,
        `"${p.student_code || ''}"`,
        `"${p.class_name || '常规补习'}"`,
        `"${subjectsStr}"`,
        `"${p.month_year || ''}"`,
        `"RM ${amt.toFixed(2)}"`,
        `"${p.status === 'Paid' ? '已缴费' : p.status === 'Overdue' ? '已逾期' : '未缴费'}"`,
        `"${p.receipt_no || '-'}"`,
        `"${p.payment_date || '-'}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    csvContent += `,,,,,,实收学费总计 (RM),"RM ${totalPaidRM.toFixed(2)}",,\n`;

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
      const student = state.students.find(s => s.id === studentId);
      if (student && student.base_fee) {
        document.getElementById('billAmount').value = getRawAmount(student.base_fee);
      }
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();
    }
  }

  async function submitCreatePaymentBill(e) {
    e.preventDefault();
    const studentId = document.getElementById('billStudentSelect').value;
    const classId = document.getElementById('billClassSelect').value;
    const month_year = document.getElementById('billMonthYear').value;
    const amount = getRawAmount(document.getElementById('billAmount').value);

    const student = state.students.find(s => s.id === studentId);
    const cls = state.classes.find(c => c.id === classId);

    if (!student) {
      showToast('请选择有效的学生', 'error');
      return;
    }

    const paymentData = {
      student_id: studentId,
      student_name: student.name,
      student_code: student.student_code,
      parent_phone: student.parent_phone,
      class_id: classId || null,
      class_name: cls ? cls.class_name : '补习课程',
      month_year,
      amount,
      status: 'Unpaid',
      receipt_no: null,
      payment_date: null,
      created_at: new Date().toISOString()
    };

    try {
      if (isConfigured && db) {
        await addDoc(collection(db, "payments"), paymentData);
      } else {
        const newId = `PAY_${Date.now()}`;
        state.payments.unshift({ id: newId, ...paymentData });
        filterAndRenderPayments();
        updateDashboardStats();
      }

      showToast('成功创建每月应缴学费账单！');
      document.getElementById('createPaymentForm').reset();
      const modal = bootstrap.Modal.getInstance(document.getElementById('createPaymentModal'));
      if (modal) modal.hide();
    } catch (err) {
      showToast("创建账单失败: " + err.message, "error");
    }
  }

  async function quickSetPaid(paymentId) {
    const payment = state.payments.find(p => p.id === paymentId);
    const receiptNo = payment?.receipt_no || generateReceiptNo(paymentId);
    const paymentDate = new Date().toISOString().replace('T', ' ').slice(0, 19);

    try {
      if (isConfigured && db) {
        const payRef = doc(db, "payments", paymentId);
        await updateDoc(payRef, {
          status: 'Paid',
          receipt_no: receiptNo,
          payment_date: paymentDate
        });
      } else {
        if (payment) {
          payment.status = 'Paid';
          payment.receipt_no = receiptNo;
          payment.payment_date = paymentDate;
        }
        filterAndRenderPayments();
        updateDashboardStats();
      }

      showToast(`已成功设为已缴费！系统派发电子收据：${receiptNo}`);
      openReceiptModal(paymentId);
    } catch (err) {
      showToast("更新支付状态失败: " + err.message, "error");
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

  async function submitUpdatePaymentStatus(e) {
    e.preventDefault();
    const paymentId = document.getElementById('editPaymentId').value;
    const status = document.getElementById('editPaymentStatus').value;
    const amount = getRawAmount(document.getElementById('editPaymentAmount').value);

    const payment = state.payments.find(p => p.id === paymentId);
    let receiptNo = payment?.receipt_no;
    let paymentDate = payment?.payment_date;

    if (status === 'Paid') {
      if (!receiptNo) receiptNo = generateReceiptNo(paymentId);
      if (!paymentDate) paymentDate = new Date().toISOString().replace('T', ' ').slice(0, 19);
    }

    try {
      if (isConfigured && db) {
        const payRef = doc(db, "payments", paymentId);
        await updateDoc(payRef, { status, amount, receipt_no: receiptNo, payment_date: paymentDate });
      } else {
        if (payment) {
          payment.status = status;
          payment.amount = amount;
          payment.receipt_no = receiptNo;
          payment.payment_date = paymentDate;
        }
        filterAndRenderPayments();
        updateDashboardStats();
      }

      showToast('学费账单状态已成功更新！');
      const modal = bootstrap.Modal.getInstance(document.getElementById('updatePaymentModal'));
      if (modal) modal.hide();
    } catch (err) {
      showToast("更新状态失败: " + err.message, "error");
    }
  }

  function openReceiptModal(paymentId) {
    const p = state.payments.find(item => item.id === paymentId);
    if (!p) {
      showToast('未找到收据记录', 'error');
      return;
    }

    const student = state.students.find(s => s.id === p.student_id) || {};

    document.getElementById('rcpNumber').textContent = p.receipt_no || generateReceiptNo(paymentId);
    document.getElementById('rcpStudentName').textContent = p.student_name || student.name || '--';
    document.getElementById('rcpStudentCode').textContent = p.student_code || student.student_code || '--';
    document.getElementById('rcpClassName').textContent = p.class_name || '常规补习课程';
    document.getElementById('rcpParentPhone').textContent = p.parent_phone || student.parent_phone || '--';
    document.getElementById('rcpSubjectDesc').textContent = p.class_name ? `${p.class_name} 补习学费` : '每月补习费用';
    document.getElementById('rcpMonthYear').textContent = p.month_year;
    document.getElementById('rcpAmount').textContent = formatMoney(p.amount);
    document.getElementById('rcpPaymentDate').textContent = p.payment_date || new Date().toLocaleString();

    const modal = new bootstrap.Modal(document.getElementById('receiptModal'));
    modal.show();
  }

  function printReceipt() {
    window.print();
  }

  // ============================================================
  // 6. 学习教材资料管理 (Materials)
  // ============================================================
  function renderMaterialsTable(materials) {
    const tbody = document.getElementById('materialsTableBody');
    if (!tbody) return;

    if (materials.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">暂无学习教材资料</td></tr>`;
      return;
    }

    tbody.innerHTML = materials.map(m => `
      <tr>
        <td class="fw-bold text-secondary">#${m.id.slice(-6)}</td>
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
          <button class="btn btn-sm btn-outline-danger" onclick="TuitionFirebaseApp.deleteMaterial('${m.id}')">
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
    const classId = document.getElementById('matClassSelect').value;
    const file_url = document.getElementById('matFileUrl').value.trim();

    const cls = state.classes.find(c => c.id === classId);

    const matData = {
      title,
      subject,
      category,
      class_id: classId || null,
      class_name: cls ? cls.class_name : '通用公共资料',
      file_url,
      uploaded_at: new Date().toISOString().slice(0, 10)
    };

    try {
      if (isConfigured && db) {
        await addDoc(collection(db, "materials"), matData);
      } else {
        const newId = `MAT_${Date.now()}`;
        state.materials.unshift({ id: newId, ...matData });
        renderMaterialsTable(state.materials);
      }

      showToast('成功上传补习教材资料！');
      document.getElementById('addMaterialForm').reset();
      const modal = bootstrap.Modal.getInstance(document.getElementById('addMaterialModal'));
      if (modal) modal.hide();
    } catch (err) {
      showToast("上传资料失败: " + err.message, "error");
    }
  }

  async function deleteMaterial(materialId) {
    if (!confirm('确定要在 Firestore 中删除这份教材资料吗？')) return;

    try {
      if (isConfigured && db) {
        await deleteDoc(doc(db, "materials", materialId));
      } else {
        state.materials = state.materials.filter(m => m.id !== materialId);
        renderMaterialsTable(state.materials);
      }

      showToast('教材资料已成功删除');
    } catch (err) {
      showToast("删除资料失败: " + err.message, "error");
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    init,
    switchTab,
    submitAddStudent,
    openEditStudentModal,
    submitEditStudent,
    onSubjectSelectionChange,
    onEditSubjectSelectionChange,
    promptAddNewSubject,
    refreshAllSubjectControls,
    exportStudentsToCSV,
    submitAddClass,
    loadAttendanceRollCall,
    setAllAttendancePresent,
    appendRemarkTag,
    submitBatchAttendance,
    quickCreateBillForStudent,
    submitCreatePaymentBill,
    quickSetPaid,
    openUpdatePaymentModal,
    submitUpdatePaymentStatus,
    openReceiptModal,
    printReceipt,
    exportPaymentsToCSV,
    submitAddMaterial,
    deleteMaterial,
    onNoticeTargetTypeChange,
    updateNoticeAudience,
    onNoticeStudentSelected,
    applyNoticeTemplate,
    insertVariableToNotice,
    copyNoticeContent,
    sendNoticeViaWhatsApp,
    sendNoticeViaWhatsAppForStudent,
    openSingleNoticeForStudent,
    saveNoticeRecord,
    openNoticeDetailModal,
    deleteNoticeRecord,
    clearAllNoticesConfirm
  };
})();
