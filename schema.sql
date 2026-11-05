-- ============================================================
-- 补习中心综合管理系统 (Tuition Centre Management System) - 数据库 Schema
-- Database Dialect: MySQL 8.0+ / MariaDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS `tuition_center_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `tuition_center_db`;

-- 1. 学生信息表 (students)
DROP TABLE IF EXISTS `student_status_logs`;
DROP TABLE IF EXISTS `materials`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `classes`;
DROP TABLE IF EXISTS `students`;

CREATE TABLE `students` (
  `student_id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_code` VARCHAR(20) NOT NULL UNIQUE COMMENT '学生学号/编号',
  `name` VARCHAR(100) NOT NULL COMMENT '学生姓名',
  `gender` ENUM('Male', 'Female') DEFAULT 'Male' COMMENT '性别',
  `phone` VARCHAR(20) DEFAULT '' COMMENT '学生联系电话',
  `parent_name` VARCHAR(100) DEFAULT '' COMMENT '家长姓名',
  `parent_phone` VARCHAR(20) NOT NULL COMMENT '家长联系电话',
  `grade` VARCHAR(50) NOT NULL COMMENT '年级 (如: 初一, 高中二年级)',
  `enrolled_subjects` VARCHAR(255) DEFAULT '' COMMENT '报读科目列表 (以逗号分隔)',
  `base_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '每月预估学费 (RM)',
  `status` ENUM('Active', 'Inactive') DEFAULT 'Active' COMMENT '在读状态',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学生信息表';

-- 2. 班级课程表 (classes)
CREATE TABLE `classes` (
  `class_id` INT AUTO_INCREMENT PRIMARY KEY,
  `class_name` VARCHAR(100) NOT NULL COMMENT '班级名称 (如: 高中数学冲刺班)',
  `subject` VARCHAR(50) NOT NULL COMMENT '科目 (数学, 英语, 物理等)',
  `grade` VARCHAR(50) NOT NULL COMMENT '适用年级',
  `teacher_name` VARCHAR(100) NOT NULL COMMENT '任课教师',
  `fee_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '每月标准学费',
  `schedule` VARCHAR(100) DEFAULT '' COMMENT '上课时间安排 (如: 周六 09:00-11:00)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='班级课程表';

-- 3. 学费支付记录表 (payments)
-- 包含: payment_id, student_id, month_year, amount, status (Paid/Unpaid/Overdue), receipt_no, updated_at
CREATE TABLE `payments` (
  `payment_id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL COMMENT '学生ID',
  `class_id` INT DEFAULT NULL COMMENT '关联班级ID',
  `month_year` VARCHAR(7) NOT NULL COMMENT '费用月份 (格式: YYYY-MM)',
  `amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '缴费金额',
  `status` ENUM('Paid', 'Unpaid', 'Overdue') DEFAULT 'Unpaid' COMMENT '支付状态',
  `receipt_no` VARCHAR(50) DEFAULT NULL COMMENT '收据编号 (RCP-YYYYMMDD-XXXX)',
  `payment_date` DATETIME DEFAULT NULL COMMENT '实缴日期',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
  CONSTRAINT `fk_payments_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`class_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学费支付记录表';

-- 4. 课堂点名与状态日志表 (student_status_logs)
CREATE TABLE `student_status_logs` (
  `log_id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL COMMENT '学生ID',
  `class_id` INT DEFAULT NULL COMMENT '班级ID (选填)',
  `subject` VARCHAR(50) DEFAULT NULL COMMENT '点名科目',
  `attendance_date` DATE NOT NULL COMMENT '点名日期',
  `status` ENUM('Present', 'Absent', 'Late', 'Excused') DEFAULT 'Present' COMMENT '考勤状态 (出席,缺席,迟到,请假)',
  `remarks` TEXT DEFAULT NULL COMMENT '课堂评语/备注标签',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '录入时间',
  CONSTRAINT `fk_logs_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_logs_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`class_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学生考勤与课堂反馈日志表';

-- 5. 学习教材资料表 (materials)
CREATE TABLE `materials` (
  `material_id` INT AUTO_INCREMENT PRIMARY KEY,
  `class_id` INT DEFAULT NULL COMMENT '关联班级 (NULL代表通用)',
  `title` VARCHAR(150) NOT NULL COMMENT '资料名称',
  `subject` VARCHAR(50) NOT NULL COMMENT '所属科目',
  `file_url` VARCHAR(255) NOT NULL COMMENT '资料链接/下载地址',
  `category` VARCHAR(50) DEFAULT '讲义' COMMENT '资料分类 (如: 讲义, 练习册, 模拟卷)',
  `uploaded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  CONSTRAINT `fk_materials_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`class_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学习教材资料表';

-- 6. 家校通知记录表 (notices)
CREATE TABLE `notices` (
  `notice_id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL COMMENT '通知标题',
  `type` VARCHAR(50) NOT NULL COMMENT '通知类型',
  `target_type` VARCHAR(50) NOT NULL COMMENT '接收对象分类 (all/filter/single)',
  `target_summary` VARCHAR(255) NOT NULL COMMENT '接收受众摘要',
  `student_id` INT DEFAULT NULL COMMENT '关联学员ID',
  `student_name` VARCHAR(100) DEFAULT '' COMMENT '学员姓名',
  `parent_phone` VARCHAR(50) DEFAULT '' COMMENT '家长电话',
  `content` TEXT NOT NULL COMMENT '通知正文内容',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '发送归档时间',
  CONSTRAINT `fk_notices_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='家校通知历史记录表';

-- ============================================================
-- 预置示例种子数据 (Seed Data)
-- ============================================================

INSERT INTO `students` (`student_id`, `student_code`, `name`, `gender`, `phone`, `parent_name`, `parent_phone`, `grade`, `enrolled_subjects`, `base_fee`, `status`) VALUES
(1, 'STU2026001', '张小明', 'Male', '60120013801', '张伟', '60121112222', '高中二年级', 'Mathematics, Add Maths, Physics', 240.00, 'Active'),
(2, 'STU2026002', '李思思', 'Female', '60120013802', '李建国', '60123334444', '初中三年级', 'English, Bahasa Melayu, Science', 240.00, 'Active'),
(3, 'STU2026003', '王梓豪', 'Male', '60120013803', '王强', '60125556666', '高中二年级', 'Mathematics, Chemistry', 160.00, 'Active'),
(4, 'STU2026004', '陈佳欣', 'Female', '60120013804', '陈光明', '60127778888', '高中一年级', 'Physics, Chemistry, Add Maths', 240.00, 'Active'),
(5, 'STU2026005', '赵一凡', 'Male', '60120013805', '赵秀兰', '60129990000', '初中三年级', 'Bahasa Melayu, Mathematics', 160.00, 'Active');

INSERT INTO `classes` (`class_id`, `class_name`, `subject`, `grade`, `teacher_name`, `fee_amount`, `schedule`) VALUES
(1, '高二数学拔尖冲刺班', '数学', '高中二年级', '林老师', 250.00, '周六 09:00-11:30'),
(2, '初三英语中考强化班', '英语', '初中三年级', 'Sarah 老师', 220.00, '周日 14:00-16:30'),
(3, '高一物理实验与理论班', '物理', '高中一年级', '王教授', 240.00, '周五 18:30-20:30'),
(4, '高考化学全真模拟班', '化学', '高中三年级', '陈老师', 260.00, '周六 14:00-17:00');

INSERT INTO `payments` (`payment_id`, `student_id`, `class_id`, `month_year`, `amount`, `status`, `receipt_no`, `payment_date`) VALUES
(1, 1, 1, '2026-10', 240.00, 'Paid', 'RCP-20261001-0101', '2026-10-01 10:30:00'),
(2, 2, 2, '2026-10', 240.00, 'Paid', 'RCP-20261002-0102', '2026-10-02 14:15:00'),
(3, 3, 1, '2026-10', 160.00, 'Unpaid', NULL, NULL),
(4, 4, 3, '2026-10', 240.00, 'Overdue', NULL, NULL),
(5, 5, 2, '2026-10', 160.00, 'Paid', 'RCP-20261004-0103', '2026-10-04 16:00:00');

INSERT INTO `student_status_logs` (`student_id`, `class_id`, `subject`, `attendance_date`, `status`, `remarks`) VALUES
(1, 1, 'Mathematics', '2026-10-14', 'Present', '积极发言,思维敏捷,回答准确'),
(3, 1, 'Mathematics', '2026-10-14', 'Late', '迟到15分钟,已补发课堂笔记'),
(2, 2, 'English', '2026-10-14', 'Present', '听力测试满分,表现优异'),
(5, 2, 'Bahasa Melayu', '2026-10-14', 'Present', '完成作业,课堂参与度高');

INSERT INTO `notices` (`template_key`, `target_type`, `title`, `target_summary`, `student_id`, `student_name`, `parent_phone`, `content`) VALUES
('monthly_fee', 'single', '2026年10月份学费缴付温馨提醒', '学员: 王梓豪 (王强 - 60125556666)', 3, '王梓豪', '60125556666', '尊敬的家长（王强先生/女士）您好：\n\n温馨提醒，您的孩子 王梓豪 在 启智补习中心 (Excel Tuition Centre) 报读的高中二年级课程，2026年10月份学费现已开始缴付。\n\n报读科目：Mathematics, Chemistry\n应缴学费总额：RM 160.00\n\n请您于本月10日前完成学费转账并将银行收条单据回复至本号码。\n若您已完成缴费，请忽略此条通知，祝孩子学业进步！');

INSERT INTO `materials` (`class_id`, `title`, `subject`, `file_url`, `category`) VALUES
(1, '2026版高二数学导数与极值突破讲义.pdf', '数学', 'https://example.com/materials/math_derivatives_2026.pdf', '讲义'),
(1, '高二数学三角函数与向量拔尖100题.pdf', '数学', 'https://example.com/materials/math_vectors_100.pdf', '练习册'),
(2, '初三英语中考核心词汇与语法冲刺手册.pdf', '英语', 'https://example.com/materials/english_zk_vocab.pdf', '讲义'),
(3, '高一物理力学与牛顿运动定律深度剖析.pdf', '物理', 'https://example.com/materials/physics_mechanics.pdf', '讲义');
