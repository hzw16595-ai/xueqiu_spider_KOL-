// ============================================================
// 雪球KOL帖子批量爬取脚本 (Chrome Console)
// ============================================================
// 用法：
//   1. 打开 https://xueqiu.com 并确保已登录
//   2. F12 → Console → 先打一个空格 → 粘贴 → 回车
//   3. 脚本会自动分页爬取，每50个KOL一批
//   4. 爬完后执行 exportData() 导出JSON
// ============================================================

// ---- KOL列表（示例数据，正式使用请替换）----
// 格式: { id: 用户ID, name: "昵称", stocks: ["SH股票代码", ...] }
// 完整KOL_LIST请自行准备或联系作者获取
const KOL_LIST = [
    { id: 2496980475, name: "滇南王", stocks: ["SH600519", "SH601318", "SH600887", "SZ000858"] },
    { id: 1929796343, name: "巴芒实践者", stocks: ["SH600519", "SH600036", "SH600276", "SZ000858"] },
    { id: 3081204011, name: "二马由之", stocks: ["SH600519", "SH600036", "SH601318", "SZ000858", "SZ000651"] },
];

// ---- 配置 ----
const CONFIG = {
    startDate: new Date('2023-01-01'),
    endDate: new Date('2025-12-31'),
    pageSize: 20,        // API每页返回条数
    maxPages: 200,       // 每个KOL最多翻200页（4000条帖子）
    delayMs: 800,        // 每次请求间隔（毫秒），防封
    batchSize: 10,       // 每批处理KOL数量
    retryCount: 3,       // 失败重试次数
};

// ---- 状态 ----
let allResults = [];      // 所有匹配帖子
let processedKols = 0;    // 已处理KOL数
let skippedKols = 0;      // 跳过KOL数（无帖子/错误）
let matchedPosts = 0;     // 匹配帖子数
let currentPage = 0;
let currentBatchStart = 0;

// ---- 工具函数 ----
function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// 从帖子text中提取股票标签
// 匹配格式: $股票名(SH600519)$ 或 $股票名(SZ000001)$
function extractStocks(text) {
    const regex = /\$([^$]+)\((SH|SZ)\d{6}\)\$/g;
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
        matches.push({
            full: m[0],
            name: m[1],
            symbol: m[2] + m[0].match(/\d{6}/)[0]
        });
    }
    return matches;
}

// 判断帖子是否为转发帖
function isRetweet(post) {
    return post.retweet_status_id && post.retweet_status_id !== 0;
}

// 获取帖子正文（含转发帖的原文）
function getFullText(post) {
    let parts = [];
    if (post.text) parts.push(post.text);
    if (isRetweet(post) && post.retweeted_status && post.retweeted_status.text) {
        parts.push(post.retweeted_status.text);
    }
    return parts.join(' ');
}

// ---- 核心爬取函数 ----
async function fetchTimeline(userId, page) {
    const url = `https://xueqiu.com/statuses/user_timeline.json?user_id=${userId}&count=${CONFIG.pageSize}&page=${page}`;
    for (let retry = 0; retry < CONFIG.retryCount; retry++) {
        try {
            const resp = await fetch(url, { credentials: 'include' });
            if (resp.status === 429) {
                console.log(`[警告] 429限速，等待5秒...`);
                await delay(5000);
                continue;
            }
            if (resp.status !== 200) {
                console.log(`[警告] HTTP ${resp.status}，重试 ${retry + 1}/${CONFIG.retryCount}`);
                await delay(2000);
                continue;
            }
            const data = await resp.json();
            return data;
        } catch (e) {
            console.log(`[错误] 请求异常: ${e.message}，重试 ${retry + 1}/${CONFIG.retryCount}`);
            await delay(2000);
        }
    }
    return null;
}

async function crawlKol(kol) {
    let page = 1;
    let kolMatches = 0;
    let shouldStop = false;

    while (page <= CONFIG.maxPages && !shouldStop) {
        const data = await fetchTimeline(kol.id, page);

        if (!data || !data.statuses || data.statuses.length === 0) {
            break; // 没有更多帖子
        }

        for (const post of data.statuses) {
            // 时间检查（created_at是毫秒时间戳）
            const postDate = new Date(post.created_at);
            if (postDate < CONFIG.startDate) {
                shouldStop = true; // 已经到了起始日期之前，停止翻页
                break;
            }
            if (postDate > CONFIG.endDate) {
                continue; // 超出结束日期，跳过但继续翻页
            }

            // 提取帖子全文中的股票标签
            const fullText = getFullText(post);
            const stocks = extractStocks(fullText);

            if (stocks.length === 0) {
                continue; // 不含股票标签，跳过
            }

            // 检查是否匹配KOL关联的股票
            const matchedStocks = stocks.filter(s => 
                kol.stocks.includes(s.symbol)
            );

            if (matchedStocks.length > 0) {
                // 也保留不匹配的标签（用于后续分析）
                const allSymbols = stocks.map(s => s.symbol);
                allResults.push({
                    post_id: post.id,
                    user_id: post.user_id,
                    user_name: post.user ? post.user.screen_name : kol.name,
                    kol_name: kol.name,
                    kol_id: kol.id,
                    created_at: post.created_at,
                    date: postDate.toISOString().split('T')[0],
                    text: post.text.replace(/<[^>]*>/g, ''),  // 去HTML标签
                    retweet: isRetweet(post),
                    retweet_text: isRetweet(post) && post.retweeted_status 
                        ? post.retweeted_status.text.replace(/<[^>]*>/g, '') 
                        : '',
                    all_stocks: allSymbols.join(';'),
                    matched_stocks: matchedStocks.map(s => s.symbol).join(';'),
                    is_matched: true,
                    like_count: post.like_count || 0,
                    reply_count: post.reply_count || 0,
                    retweet_count: post.retweet_count || 0,
                });
                kolMatches++;
                matchedPosts++;
            } else {
                // 含标签但不匹配KOL关联股票的帖子也保留（可选）
                // 如果不需要可以注释掉这段
                allResults.push({
                    post_id: post.id,
                    user_id: post.user_id,
                    user_name: post.user ? post.user.screen_name : kol.name,
                    kol_name: kol.name,
                    kol_id: kol.id,
                    created_at: post.created_at,
                    date: postDate.toISOString().split('T')[0],
                    text: post.text.replace(/<[^>]*>/g, ''),
                    retweet: isRetweet(post),
                    retweet_text: isRetweet(post) && post.retweeted_status 
                        ? post.retweeted_status.text.replace(/<[^>]*>/g, '') 
                        : '',
                    all_stocks: stocks.map(s => s.symbol).join(';'),
                    matched_stocks: '',
                    is_matched: false,
                    like_count: post.like_count || 0,
                    reply_count: post.reply_count || 0,
                    retweet_count: post.retweet_count || 0,
                });
            }
        }

        page++;
        await delay(CONFIG.delayMs);
    }

    return kolMatches;
}

// ---- 批次执行 ----
async function runBatch(startIdx) {
    const end = Math.min(startIdx + CONFIG.batchSize, KOL_LIST.length);
    console.log(`\n========== 批次 ${Math.floor(startIdx / CONFIG.batchSize) + 1}: KOL #${startIdx + 1} ~ #${end} ==========`);

    for (let i = startIdx; i < end; i++) {
        const kol = KOL_LIST[i];
        processedKols++;
        const progress = `[${processedKols}/${KOL_LIST.length}]`;

        console.log(`${progress} 爬取: ${kol.name} (ID:${kol.id}, 关联${kol.stocks.length}只股票, status_count待查)`);

        try {
            const matches = await crawlKol(kol);
            console.log(`  → 匹配 ${matches} 条帖子`);
        } catch (e) {
            console.log(`  → 错误: ${e.message}`);
            skippedKols++;
        }
    }

    console.log(`\n批次完成。当前总计: ${matchedPosts} 条匹配帖子，${processedKols} 个KOL已处理`);
    console.log(`如需继续下一批，执行 runNextBatch()`);
}

async function runNextBatch() {
    currentBatchStart += CONFIG.batchSize;
    if (currentBatchStart >= KOL_LIST.length) {
        console.log('所有KOL已处理完毕！');
        return;
    }
    await runBatch(currentBatchStart);
}

// ---- 导出 ----
function exportData() {
    const matched = allResults.filter(r => r.is_matched);
    const unmatched = allResults.filter(r => !r.is_matched);
    
    console.log(`\n===== 导出汇总 =====`);
    console.log(`总帖子数: ${allResults.length}`);
    console.log(`匹配KOL关联股票: ${matched.length}`);
    console.log(`含标签但不匹配: ${unmatched.length}`);
    console.log(`处理KOL数: ${processedKols}`);
    console.log(`跳过KOL数: ${skippedKols}`);
    
    // 匹配帖子的股票覆盖
    const stockCoverage = {};
    matched.forEach(r => {
        r.matched_stocks.split(';').forEach(s => {
            stockCoverage[s] = (stockCoverage[s] || 0) + 1;
        });
    });
    console.log(`\n覆盖股票数: ${Object.keys(stockCoverage).length}`);
    console.log('各股票帖子数（前10）:');
    Object.entries(stockCoverage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([s, c]) => console.log(`  ${s}: ${c} 条`));

    // 生成JSON并复制到剪贴板
    const exportObj = {
        export_time: new Date().toISOString(),
        total_posts: allResults.length,
        matched_posts: matched.length,
        unmatched_posts: unmatched.length,
        processed_kols: processedKols,
        stock_coverage: stockCoverage,
        posts: allResults
    };

    const json = JSON.stringify(exportObj, null, 2);
    
    // 尝试复制到剪贴板
    try {
        navigator.clipboard.writeText(json).then(() => {
            console.log('\n✅ JSON已复制到剪贴板！请粘贴保存为 xueqiu_posts.json');
        }).catch(() => {
            console.log('\n剪贴板复制失败，请手动复制下面的JSON');
        });
    } catch(e) {
        console.log('\n剪贴板API不可用，请手动复制');
    }
    
    // 也存到localStorage作为备份
    try {
        localStorage.setItem('xueqiu_crawl_results', json);
        console.log('✅ 已同时保存到 localStorage["xueqiu_crawl_results"]');
        console.log('恢复命令: JSON.parse(localStorage.getItem("xueqiu_crawl_results"))');
    } catch(e) {
        console.log('localStorage保存失败（数据太大）');
    }
    
    return json;
}

// ---- 统计 ----
function showProgress() {
    console.log(`\n===== 当前进度 =====`);
    console.log(`已处理KOL: ${processedKols} / ${KOL_LIST.length}`);
    console.log(`匹配帖子数: ${matchedPosts}`);
    console.log(`跳过KOL数: ${skippedKols}`);
    console.log(`已存储帖子总数: ${allResults.length}`);
}

// ---- 启动 ----
(async function() {
    console.log(`准备爬取 ${KOL_LIST.length} 个KOL的帖子...`);
    console.log(`日期范围: ${CONFIG.startDate.toISOString().split('T')[0]} ~ ${CONFIG.endDate.toISOString().split('T')[0]}`);
    console.log(`每个KOL最多翻 ${CONFIG.maxPages} 页`);
    console.log(`每批处理 ${CONFIG.batchSize} 个KOL，批次间需手动执行 runNextBatch()`);
    console.log(`\n开始第一批...`);
    await runBatch(0);
})();
