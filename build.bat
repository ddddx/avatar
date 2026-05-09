@echo off 
cd /d C:\Users\Administrator\Desktop\avatar 
rmdir /s /q dist 
node node_modules\vite\bin\vite.js build 
echo BUILD_DONE 
