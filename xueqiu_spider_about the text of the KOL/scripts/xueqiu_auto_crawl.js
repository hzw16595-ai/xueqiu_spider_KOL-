// ============================================================
// 雪球KOL帖子自动连续爬取脚本 (Chrome Console)
// 特性：自动连续跑 + 每50个KOL自动下载CSV（文件名带KOL范围）
// ============================================================
// 用法：在已登录的雪球页面Console粘贴执行
// 会自动从当前进度继续，无需手动runNextBatch()
// ============================================================

// ---- 配置 ----
const AUTO_CONFIG = {
    startDate: new Date('2023-01-01'),
    endDate: new Date('2025-12-31'),#配置需抓取的帖子的时间范围
    pageSize: 20,
    maxPages: 200,
    delayMs: 800,
    retryCount: 3,
    autoExportInterval: 50,  // 每处理50个KOL自动导出一次CSV
};

// ---- 复用当前内存中的数据 ----
// 如果allResults已存在，说明之前有数据，直接续跑
if (typeof allResults === 'undefined') {
       // allResults已存在，不重复声明

    console.log('⚠️ 未检测到已有数据，从头开始');
} else {
    console.log(`✅ 检测到已有数据: ${allResults.length} 条帖子，${processedKols} 个KOL已处理`);
}

// ---- 工具函数 ----
function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

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

function isRetweet(post) {
    return post.retweet_status_id && post.retweet_status_id !== 0;
}

function getFullText(post) {
    let parts = [];
    if (post.text) parts.push(post.text);
    if (isRetweet(post) && post.retweeted_status && post.retweeted_status.text) {
        parts.push(post.retweeted_status.text);
    }
    return parts.join(' ');
}

function escapeCSV(str) {
    if (str === null || str === undefined) return '';
    str = String(str);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function formatTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}

// ---- 自动CSV导出（文件名带KOL范围：191-240, 241-290, ...）----
function autoExportCSV() {
    if (allResults.length === 0) return;
    const headers = ['post_id','user_id','user_name','kol_name','kol_id','datetime','date','text','retweet','retweet_text','all_stocks','matched_stocks','is_matched','like_count','reply_count','retweet_count'];
    let csv = '\uFEFF' + headers.join(',') + '\n';
    for (const row of allResults) {
        const vals = headers.map(h => h === 'datetime' ? escapeCSV(formatTime(row.created_at)) : escapeCSV(row[h]));
        csv += vals.join(',') + '\n';
    }
    const matched = allResults.filter(r => r.is_matched);
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    const now = new Date();
    const ts = now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0')+'_'+String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0');
    // 计算当前KOL所属的50区间范围
    const batchIdx = Math.floor((processedKols - 1) / 50);
    const rangeStart = batchIdx * 50 + 1;
    const rangeEnd = processedKols;
    a.href = URL.createObjectURL(blob);
    a.download = `xueqiu_KOL${rangeStart}-${rangeEnd}_${ts}_${matched.length}条.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    console.log(`\n💾 自动导出: KOL #${rangeStart}~#${rangeEnd}，${matched.length}条匹配`);
}

// ---- 核心爬取函数（同原版）----
async function fetchTimeline(userId, page) {
    const url = `https://xueqiu.com/statuses/user_timeline.json?user_id=${userId}&count=${AUTO_CONFIG.pageSize}&page=${page}`;
    for (let retry = 0; retry < AUTO_CONFIG.retryCount; retry++) {
        try {
            const resp = await fetch(url, { credentials: 'include' });
            if (resp.status === 429) {
                console.log(`  [429限速] 等待5秒...`);
                await delay(5000);
                continue;
            }
            if (resp.status !== 200) {
                console.log(`  [HTTP ${resp.status}] 重试 ${retry + 1}/${AUTO_CONFIG.retryCount}`);
                await delay(2000);
                continue;
            }
            const data = await resp.json();
            return data;
        } catch (e) {
            console.log(`  [异常] ${e.message}，重试 ${retry + 1}/${AUTO_CONFIG.retryCount}`);
            await delay(2000);
        }
    }
    return null;
}

async function crawlKol(kol) {
    let page = 1;
    let kolMatches = 0;
    let shouldStop = false;

    while (page <= AUTO_CONFIG.maxPages && !shouldStop) {
        const data = await fetchTimeline(kol.id, page);

        if (!data || !data.statuses || data.statuses.length === 0) {
            break;
        }

        for (const post of data.statuses) {
            const postDate = new Date(post.created_at);
            if (postDate < AUTO_CONFIG.startDate) {
                shouldStop = true;
                break;
            }
            if (postDate > AUTO_CONFIG.endDate) {
                continue;
            }

            const fullText = getFullText(post);
            const stocks = extractStocks(fullText);

            if (stocks.length === 0) continue;

            const matchedStocks = stocks.filter(s => kol.stocks.includes(s.symbol));
            const allSymbols = stocks.map(s => s.symbol);

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
                all_stocks: allSymbols.join(';'),
                matched_stocks: matchedStocks.map(s => s.symbol).join(';'),
                is_matched: matchedStocks.length > 0,
                like_count: post.like_count || 0,
                reply_count: post.reply_count || 0,
                retweet_count: post.retweet_count || 0,
            });

            if (matchedStocks.length > 0) kolMatches++;
        }

        page++;
        await delay(AUTO_CONFIG.delayMs);
    }

    return kolMatches;
}

// ---- 自动连续执行 ----
async function autoRun() {
    // 确定从哪里开始：如果processedKols>0，从processedKols开始
    const startIdx = processedKols;
    const total = KOL_LIST.length;
    
    if (startIdx >= total) {
        console.log('✅ 所有KOL已处理完毕！');
        autoExportCSV();
        return;
    }

    console.log(`\n🚀 自动连续爬取模式启动`);
    console.log(`从第 ${startIdx + 1} 个KOL开始，剩余 ${total - startIdx} 个`);
    console.log(`每 ${AUTO_CONFIG.autoExportInterval} 个KOL自动导出一次CSV`);
    console.log(`预计耗时: ~${Math.ceil((total - startIdx) * 1.5 / 60)} 分钟\n`);

    let lastExportAt = startIdx; // 上次导出时的KOL位置

    for (let i = startIdx; i < total; i++) {
        const kol = KOL_LIST[i];
        processedKols++;
        console.log(`[${processedKols}/${total}] ${kol.name} (ID:${kol.id}, ${kol.stocks.length}只股票)`);

        try {
            const matches = await crawlKol(kol);
            console.log(`  → ${matches} 条匹配`);
        } catch (e) {
            console.log(`  → 错误: ${e.message}`);
            skippedKols++;
        }

        // 自动导出检查
        if ((processedKols - lastExportAt) >= AUTO_CONFIG.autoExportInterval || processedKols === total) {
            autoExportCSV();
            lastExportAt = processedKols;
        }
    }

    console.log(`\n🎉 全部完成！共处理 ${processedKols} 个KOL，${allResults.length} 条帖子`);
    autoExportCSV();
}


