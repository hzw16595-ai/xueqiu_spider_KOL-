# -*- coding: utf-8 -*-
"""
雪球帖子数据合并工具
- 扫描指定目录下的所有 CSV 文件
- 按 post_id 去重（保留最新出现的记录）
- 数据安全：不修改原文件，只读取+输出合并文件
- 支持交互式指定目录，也支持命令行参数

用法：
    python merge_csv.py                          # 交互式
    python merge_csv.py ./data ./output          # 指定输入输出目录
"""

import os
import csv
import time
from collections import OrderedDict
import argparse


def merge_csv_files(input_dir, output_dir):
    """合并指定目录下所有 CSV 文件，按 post_id 去重"""
    os.makedirs(output_dir, exist_ok=True)

    # 扫描所有 CSV
    csv_files = [
        os.path.join(input_dir, f)
        for f in os.listdir(input_dir)
        if f.endswith('.csv')
    ]

    if not csv_files:
        print(f'[!] 目录下没有找到 CSV 文件: {input_dir}')
        return

    print(f'[+] 找到 {len(csv_files)} 个 CSV 文件')
    for f in csv_files:
        size_mb = os.path.getsize(f) / 1024 / 1024
        print(f'    {os.path.basename(f)} ({size_mb:.1f}MB)')

    # 合并去重
    merged = OrderedDict()
    header = None
    total_rows = 0

    start_time = time.time()

    for fi, filepath in enumerate(csv_files, 1):
        fname = os.path.basename(filepath)
        rows_this_file = 0

        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                if header is None:
                    header = reader.fieldnames
                for row in reader:
                    post_id = row.get('post_id', '') or row.get('id', '') or str(fi)
                    merged[post_id] = row
                    rows_this_file += 1
                    total_rows += 1
            print(f'  [{fi}/{len(csv_files)}] {fname}: +{rows_this_file:,} 行')

        except Exception as e:
            print(f'  [!] {fname}: 读取失败 - {e}')

    elapsed = time.time() - start_time
    print(f'\n[+] 读取完成: {total_rows:,} 行原始数据，去重后 {len(merged):,} 行 ({elapsed:.1f}s)')

    # 写入输出
    output_path = os.path.join(output_dir, 'merged_output.csv')
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        for row in merged.values():
            writer.writerow(row)

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f'[+] 输出: {output_path} ({size_mb:.1f}MB)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='合并雪球帖子 CSV 数据')
    parser.add_argument('input_dir', nargs='?', default=None, help='CSV 文件所在目录')
    parser.add_argument('output_dir', nargs='?', default=None, help='输出目录')
    args = parser.parse_args()

    if args.input_dir is None:
        input_dir = input('请输入 CSV 文件所在目录路径: ').strip()
        output_dir = input('请输入输出目录路径（直接回车则与输入目录相同）: ').strip()
        if not output_dir:
            output_dir = input_dir
    else:
        input_dir = args.input_dir
        output_dir = args.output_dir if args.output_dir else input_dir

    if os.path.isdir(input_dir):
        merge_csv_files(input_dir, output_dir)
    else:
        print(f'[!] 目录不存在: {input_dir}')
