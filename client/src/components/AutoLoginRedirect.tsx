
import React, { useEffect } from 'react';

interface AutoLoginRedirectProps {
  token: string;
}

export function AutoLoginRedirect({ token }: AutoLoginRedirectProps) {
  useEffect(() => {
    const performAutoLogin = async () => {
      try {
        // Thực hiện request đăng nhập với bearer token
        const response = await fetch('https://emso.vn/api/auth/token-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });

        if (response.ok) {
          // Nếu đăng nhập thành công, chuyển hướng đến trang chính
          window.location.href = 'https://emso.vn/';
        } else {
          // Nếu thất bại, hiển thị form đăng nhập với token đã điền sẵn
          const loginForm = document.createElement('form');
          loginForm.method = 'POST';
          loginForm.action = 'https://emso.vn/login';
          
          const tokenInput = document.createElement('input');
          tokenInput.type = 'hidden';
          tokenInput.name = 'token';
          tokenInput.value = token;
          
          loginForm.appendChild(tokenInput);
          document.body.appendChild(loginForm);
          loginForm.submit();
        }
      } catch (error) {
        console.error('Auto-login failed:', error);
        // Fallback: chuyển hướng với token trong URL
        window.location.href = `https://emso.vn/login?token=${encodeURIComponent(token)}`;
      }
    };

    performAutoLogin();
  }, [token]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Đang đăng nhập vào emso.vn...</p>
        <p className="text-sm text-gray-500 mt-2">Token: {token.substring(0, 20)}...</p>
      </div>
    </div>
  );
}
