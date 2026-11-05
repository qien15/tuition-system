/**
 * firebase-config.js
 * Firebase v10 Modular SDK 初始化与配置模块
 * 支持 Authentication, Firestore, Cloud Storage
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Firebase 项目凭证配置 (请替换为您自己的 Firebase 控制台参数)
const firebaseConfig = {
  apiKey: "AIzaSyDemoKey_ReplaceWithYourActualApiKeyHere",
  authDomain: "tuition-center-demo.firebaseapp.com",
  projectId: "tuition-center-demo",
  storageBucket: "tuition-center-demo.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// 检查是否配置了真实的 Firebase 项目
const isConfigured = !firebaseConfig.apiKey.includes("ReplaceWithYourActualApiKeyHere");

let app, auth, db, storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // 尝试启用离线持久化存储
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firebase 离线支持未启用：多个标签页同时打开');
    } else if (err.code === 'unimplemented') {
      console.warn('当前浏览器不支持 Firebase 离线存储');
    }
  });

} catch (error) {
  console.error("Firebase 初始化异常:", error);
}

export { app, auth, db, storage, isConfigured };
