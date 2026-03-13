@echo off
echo 请先停止开发服务器 (Ctrl+C)，然后按任意键继续...
pause > nul
echo 正在重新生成 Prisma Client...
call npx prisma generate
if %errorlevel% equ 0 (
    echo Prisma Client 生成成功！请重新启动开发服务器: npm run dev
) else (
    echo 生成失败，请确保已完全关闭开发服务器后重试
)
pause
