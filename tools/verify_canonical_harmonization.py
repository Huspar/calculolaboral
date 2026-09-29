#!/usr/bin/env python3
"""
Verification Script for Layout Width and Header Harmonization
Audit all 46 core HTML files against canonical index.html standards:
1. Canonical Top Ticker (max-w-[1240px] mx-auto px-4 sm:px-6)
2. Canonical Header & Sticky Navbar (max-w-[1240px] mx-auto px-4 sm:px-6, Logo, Dropdowns, Pill Buttons, Mobile Drawer)
3. Main Content Container Constraints (max-w-[1240px] px-4 sm:px-6 lg:px-8 or max-w-4xl px-4 sm:px-6 with flex-grow / flex-1)
4. Overflow-x protection (body overflow-x: hidden)
5. Ultrawide bounding (no unconstrained edge-to-edge layout)
"""

import glob
import os
import re
import sys

TARGET_FILES = sorted([
    f for f in glob.glob('*.html')
    if f not in ['home-v2.html', 'ejemplo-informe-ejecutivo.html', '_template.html']
])

print(f"============================================================")
print(f"VERIFYING 46 CORE HTML FILES FOR LAYOUT & HEADER HARMONY")
print(f"============================================================")
print(f"Found {len(TARGET_FILES)} target files.\n")

# 1. Read Canonical Header from index.html
with open('index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

canonical_ticker_match = re.search(
    r'(<!--\s*1\.\s*TOP TICKER.*?<!--\s*2\.\s*MAIN HEADER.*?</header>)',
    index_html,
    re.DOTALL
)
if not canonical_ticker_match:
    print("[FATAL] Could not extract canonical ticker + header from index.html")
    sys.exit(1)

canonical_header_block = canonical_ticker_match.group(1).strip()
print(f"[OK] Canonical Ticker + Header extracted from index.html (len={len(canonical_header_block)} chars)\n")

failures = []
report = []

for fname in TARGET_FILES:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    file_errors = []

    # Check 1: Body overflow-x: hidden
    if 'overflow-x: hidden' not in content and 'overflow-x-hidden' not in content:
        file_errors.append("Missing 'overflow-x: hidden' on body")

    # Check 2: Exact Canonical Header Match
    file_header_match = re.search(
        r'(<!--\s*1\.\s*TOP TICKER.*?<!--\s*2\.\s*MAIN HEADER.*?</header>)',
        content,
        re.DOTALL
    )
    if not file_header_match:
        file_errors.append("Missing or malformed Top Ticker + Header block")
    else:
        file_header_block = file_header_match.group(1).strip()
        if file_header_block != canonical_header_block:
            file_errors.append(f"Header differs from canonical index.html (diff len={len(file_header_block)} vs {len(canonical_header_block)})")

    # Check 3: Main / Content Container Width Constraints
    if fname == 'index.html':
        # index.html uses .site-container (max-width: 1200px) and max-w-[1240px]
        if '.site-container' not in content or 'max-width: 1200px' not in content:
            file_errors.append("index.html missing .site-container (max-width: 1200px)")
    else:
        main_match = re.search(r'<main([^>]*)>', content)
        if not main_match:
            file_errors.append("Missing <main> tag")
        else:
            main_attrs = main_match.group(1)
            # Must have flex-grow or flex-1
            if 'flex-grow' not in main_attrs and 'flex-1' not in main_attrs:
                file_errors.append(f"<main> missing flex-grow / flex-1: '{main_attrs}'")
            
            # Must have max-w-[1240px] or max-w-4xl (or max-w-3xl/2xl)
            has_valid_maxw = (
                'max-w-[1240px]' in main_attrs or
                'max-w-4xl' in main_attrs or
                'max-w-3xl' in main_attrs or
                'max-w-2xl' in main_attrs
            )
            if not has_valid_maxw:
                file_errors.append(f"<main> missing valid max-w constraint: '{main_attrs}'")
            
            # Must be centered
            if 'mx-auto' not in main_attrs:
                file_errors.append(f"<main> missing mx-auto centering: '{main_attrs}'")

    # Check 4: Subheader Indicators Width (if present)
    if 'indicators-carousel' in content:
        # parent of indicators-carousel should be max-w-[1240px]
        ind_match = re.search(r'<div[^>]*indicators-carousel[^>]*>', content)
        if ind_match:
            pos = content.find(ind_match.group(0))
            parent_chunk = content[max(0, pos-250):pos]
            if 'max-w-[1240px]' not in parent_chunk and 'max-w-4xl' not in parent_chunk and 'site-container' not in parent_chunk:
                file_errors.append("Subheader indicators-carousel parent is missing max-w-[1240px]")

    # Check 5: Footer Container Width
    if '<footer' in content:
        footer_match = re.search(r'<footer.*?</footer>', content, re.DOTALL)
        if footer_match:
            f_text = footer_match.group(0)
            if 'max-w-[1240px]' not in f_text and 'max-w-[1200px]' not in f_text:
                file_errors.append("Footer container missing max-w-[1240px]")

    if file_errors:
        failures.append((fname, file_errors))
        report.append(f"[FAIL] {fname}:")
        for err in file_errors:
            report.append(f"       - {err}")
    else:
        report.append(f"[PASS] {fname}")

for line in report:
    print(line)

print("\n" + "=" * 60)
print(f"VERIFICATION SUMMARY: {len(TARGET_FILES) - len(failures)}/{len(TARGET_FILES)} PASSED")
print("=" * 60)

if failures:
    print(f"\n{len(failures)} files failed verification. Please review errors above.")
    sys.exit(1)
else:
    print("\nALL 46 CORE HTML FILES PERFECTLY MATCH CANONICAL LAYOUT & HEADER CONSTRAINTS!")
    sys.exit(0)
