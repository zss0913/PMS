# Git 版本管理使用说明

## 已完成

- ✅ 已初始化 Git 仓库
- ✅ 已创建首次提交（41 个文件）

---

## 常用命令

### 提交新版本（代码修改后）

```bash
cd "d:\康华数据\物业管理系统\PMS"
git add -A
git commit -m "描述你的修改内容"
```

### 查看提交历史

```bash
git log --oneline
```

### 恢复某个版本

```bash
# 1. 先查看历史，找到要恢复的版本号（如 61ec1b4）
git log --oneline

# 2. 恢复整个项目到该版本（会丢弃之后的修改）
git reset --hard 61ec1b4

# 3. 或只恢复某个文件
git checkout 61ec1b4 -- 文件路径
```

### 查看当前状态

```bash
git status
```

### 查看修改内容

```bash
git diff
```

---

## 说明

- `.env` 文件不会被提交（含密码等敏感信息）
- `node_modules`、`.next` 等构建产物已忽略
- 新成员克隆后需复制 `.env.example` 为 `.env` 并填写配置
