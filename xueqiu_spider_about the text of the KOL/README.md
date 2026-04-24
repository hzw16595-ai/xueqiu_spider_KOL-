# 雪球帖子爬虫 (xueqiu-spider)

基于浏览器自动化的雪球（xueqiu.com）帖子内容爬取工具，支持全自动翻页抓取、CSV导出与KOL列表获取。

> ⚠️ 仅供学术研究用途。使用前请阅读 [使用说明](#使用说明) 并遵守雪球平台规则。

---

## 功能特性

- 🔍 **全自动爬取**：自动翻页、自动等待加载、防检测延迟
- 📊 **CSV导出**：增量导出已爬取的帖子数据
- 👥 **KOL列表**（可选）：获取雪球认证用户的关注列表
- 🛡️ **轻量依赖**：无需复杂框架，仅需 Chrome + Node.js 环境

---

## 文件说明

```
scripts/
├── xueqiu_auto_crawl.js    # 【推荐】全自动版：自动翻页 + 提取帖子
├── xueqiu_batch_crawl.js   # 半自动版：手动翻页，脚本仅提取当前页
├── export_csv.js           # 增量导出 CSV
└── export_kol.js           # 获取 KOL 关注列表（可选功能）

tools/
├── merge_csv.py            # 合并多批次 CSV 文件
├── sample_for_labeling.py  # 采样供人工标注
└── export_cookie.js        # 导出浏览器登录 Cookie

start_chrome.bat            # 启动 Chrome（无痕模式 + 调试端口）
start_chrome_debug.bat      # 以调试模式启动 Chrome
```

---

## 环境准备

### 1. 安装依赖

```bash
pip install pandas
```

### 2. 启动 Chrome 调试模式

运行以下命令启动 Chrome（建议使用无痕模式避免 Cookie 污染）：

```bash
start_chrome.bat
```

或在命令行手动执行：

```bash
# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome_temp" --incognito

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="$HOME/chrome_temp" --incognito
```

### 3. 登录雪球

在打开的 Chrome 窗口中打开 xueqiu.com，登录你的账号。

> 💡 如果需要导入已有 Cookie，运行 `export_cookie.js`（在 Console 中粘贴并执行）。
> 💡 如果没有办法导出cookie，可以选择将脚本(scripts/xueqiu_auto_crawl.js)中的文本复制后粘贴到Console并运行
> 💡 遇到开发者工具卡了，可以试着用ctrl+F8、F8刷新

### 4. 打开目标页面

在 Chrome 中进入你想爬取的用户主页或话题页面，例如：
```
https://xueqiu.com/u/你的目标用户ID
```

---

## 使用流程

### Step 0：准备 KOL 列表

在运行脚本前，需要准备好 `KOL_LIST`（用户ID和关注股票列表）。

**格式：**
```javascript
const KOL_LIST = [
    { id: 1234567890, name: "用户昵称", stocks: ["SH600519", "SZ000858"] },
    // ... 更多KOL
];
```

**获取方式：**
- 在雪球用户主页 URL 中获取 ID，例如 `xueqiu.com/u/1234567890`
- 股票代码格式：`SH` + 上交所6位代码，或 `SZ` + 深交所6位代码

> 📌 示例代码中已内置3个KOL作为演示，正式使用时请替换为你的研究数据。

### Step 1：爬取帖子（两种模式二选一）

#### 模式A：全自动爬取（推荐）

打开 Chrome DevTools（F12），切换到 **Console** 标签，粘贴以下内容并回车：

```javascript
// 复制 scripts/xueqiu_auto_crawl.js 的内容粘贴到 Console
// 脚本将自动翻页、自动提取，直到"下一页"按钮不可用
```

**效果**：脚本将自动翻到下一页、等待帖子加载、提取数据，全程无需手动操作。

#### 模式B：半自动爬取

如果全自动版遇到问题，可使用半自动版 `xueqiu_batch_crawl.js`：
- 脚本**不自动翻页**
- 你手动翻到下一页后，脚本自动提取当前页帖子
- 每次翻页后粘贴执行一次

### Step 2：导出 CSV

当页面帖子全部爬取完成后（脚本输出"爬取完毕"），执行：

```javascript
// 复制 scripts/export_csv.js 的内容粘贴到 Console
// 数据将自动下载为 CSV 文件
```

### Step 3：合并多批次数据

如果你需要爬取多个页面，将各页 CSV 放在同一文件夹后，运行：

```bash
python tools/merge_csv.py
```

合并后的数据将输出到 `merged_output/` 目录。

---

## 数据字段说明

导出的 CSV 包含以下字段：

| 字段 | 说明 |
|:---|:---|
| `post_id` | 帖子唯一ID |
| `user_id` | 用户ID |
| `user_name` | 用户昵称 |
| `user_screen_name` | 用户主页名 |
| `created_at` | 发布时间（时间戳） |
| `text` | 帖子正文（HTML格式） |
| `text_plain` | 帖子正文（纯文本） |
| `like_count` | 点赞数 |
| `comment_count` | 评论数 |
| `repost_count` | 转发数 |
| `quote_cards` | 引用卡片内容（如有） |
| `retweet_id` | 转发来源ID（如为转发） |

---

## 常见问题

**Q：脚本运行后没有反应？**
> 检查是否在正确页面（用户主页），确保帖子已完全加载后粘贴脚本。

**Q：翻页中途停止？**
> 可重新刷新页面，已爬取的数据在 CSV 中，手动删除重复行后继续。

**Q：Cookie 过期了？**
> 重新在 Chrome 登录 xueqiu.com，再次运行 `export_cookie.js`。

---

## 数据安全提示

- 爬取的数据仅供学术研究使用
- 不要传播包含个人信息的完整 Cookie
- 遵守雪球 robots.txt 约定，避免高频请求

---

## License

MIT License
