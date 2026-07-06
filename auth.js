
(function () {
  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('hrUser') || sessionStorage.getItem('hrUser') || 'null');
    } catch (_) {
      return null;
    }
  }

  const user = getStoredUser();
  const currentPage = location.pathname.split('/').pop() || 'index.html';

  if (!user && currentPage !== 'login.html') {
    // จำหน้าที่ตั้งใจจะเข้า ไว้เพื่อเด้งกลับมาหลัง login สำเร็จ (ถ้าอยากทำ redirect-back เพิ่มทีหลังได้)
    sessionStorage.setItem('hrRedirectAfterLogin', currentPage);
    location.href = 'login.html';
  }

  // เปิดให้ทุกหน้าเรียกใช้ผ่าน window.HR_AUTH
  window.HR_AUTH = {
    user: user,
    getUser: getStoredUser,
    logout: function () {
      localStorage.removeItem('hrUser');
      sessionStorage.removeItem('hrUser');
      location.href = 'login.html';
    }
  };
})();