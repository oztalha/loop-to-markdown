// ==UserScript==
// @name         Microsoft Loop to MediaWiki
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Convert Microsoft Loop pages to MediaWiki wikitext
// @author       OpenAI Codex
// @match        https://loop.cloud.microsoft/*
// @match        https://*.loop.cloud.microsoft.com/*
// @grant        GM_setClipboard
// @license      GPL-3.0
// ==/UserScript==

(function() {
    'use strict';

    const copyToClipboard = async text => {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text, 'text');
            return;
        }

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    };

    const normalize = text => {
        if (!text) return '';
        return text.trim().replace(/\s+/g, ' ');
    };

    const escapeHtml = text => text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const escapeTableCell = text => text.replace(/\|/g, '<nowiki>|</nowiki>');

    const getMention = el => {
        const avatar = el.querySelector('.fui-Avatar[aria-label]');
        return avatar ? `@${avatar.getAttribute('aria-label')}` : '';
    };

    const getPageTitle = pages => {
        const candidateSelectors = [
            'div[role="heading"][aria-level="1"]',
            '[data-automation-id="page-title"]',
            '[data-testid="page-title"]',
            '[aria-label="Title"]',
            'input[aria-label="Title"]',
            'textarea[aria-label="Title"]'
        ];

        for (const selector of candidateSelectors) {
            const el = document.querySelector(selector);
            const value = normalize(el?.value || el?.textContent || '');
            if (value) return value;
        }

        const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
        if (metaTitle) return normalize(metaTitle);

        const docTitle = normalize(document.title.replace(/\s*[-|].*$/, ''));
        if (docTitle) return docTitle;

        const firstPara = pages[0]?.querySelector('.scriptor-paragraph:not([role="heading"] *)');
        if (firstPara && !firstPara.querySelector('[role="heading"]') && !firstPara.closest('.scriptor-listItem, table')) {
            return normalize(firstPara.textContent);
        }

        return '';
    };

    const formatExternalLink = (label, href) => {
        const cleanLabel = normalize(label);
        if (!href) return cleanLabel;
        if (!cleanLabel || cleanLabel === href) return href;
        return `[${href} ${cleanLabel}]`;
    };

    const formatCheckbox = checked => checked ? '☑' : '☐';
    const formatInlineCode = text => `<code>${escapeHtml(text)}</code>`;
    const formatBold = text => `'''${text}'''`;

    const getTextContent = (container, skipTables = false) => {
        let text = '';
        const targets = container.querySelectorAll('.scriptor-textRun, [data-testid="resolvedAtMention"]');
        if (targets.length === 0) {
            return getTextContentFallback(container);
        }

        targets.forEach(node => {
            if (skipTables && node.closest('table')) return;
            if (node.dataset.testid === 'resolvedAtMention') {
                text += getMention(node);
                return;
            }
            if (node.closest('[data-testid="resolvedAtMention"]')) return;

            if (node.classList.contains('scriptor-hyperlink')) {
                const href = (node.getAttribute('title') || '').split('\n')[0];
                text += formatExternalLink(node.textContent, href);
                return;
            }

            if (node.classList.contains('scriptor-code-editor')) {
                text += formatInlineCode(node.textContent);
                return;
            }

            const content = node.textContent;
            const style = window.getComputedStyle(node);
            const isBold = parseInt(style.fontWeight, 10) >= 600 || style.fontWeight === 'bold' || style.fontWeight === 'bolder';
            if (isBold && content.trim()) {
                const lead = content.match(/^\s*/)[0];
                const trail = content.match(/\s*$/)[0];
                text += `${lead}${formatBold(content.trim())}${trail}`;
                return;
            }

            text += content;
        });

        return normalize(text);
    };

    const getTextContentFallback = (container) => {
        let text = '';

        const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const el = node;
            const tag = el.tagName.toLowerCase();

            if (el.dataset?.testid === 'resolvedAtMention') {
                const mention = getMention(el);
                if (mention) {
                    text += mention;
                    return;
                }
            }

            if (tag === 'a') {
                const href = el.getAttribute('href') || el.getAttribute('title')?.split('\n')[0] || '';
                const linkText = el.textContent.trim();
                if (href && linkText) {
                    text += formatExternalLink(linkText, href);
                    return;
                }
            }

            if (el.classList?.contains('scriptor-code-editor')) {
                text += formatInlineCode(el.textContent);
                return;
            }

            for (const child of el.childNodes) {
                walk(child);
            }
        };

        for (const child of container.childNodes) {
            walk(child);
        }

        return normalize(text);
    };

    const detectCodeLanguage = (code, element) => {
        const langAttr = element?.getAttribute('data-language') ||
            element?.closest('[data-language]')?.getAttribute('data-language') ||
            element?.querySelector('[data-language]')?.getAttribute('data-language');
        if (langAttr) return langAttr.toLowerCase();

        const trimmed = code.trim();
        if (/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey)\s/i.test(trimmed)) return 'mermaid';
        if (/^(def |class |import |from |async def |@\w+)/.test(trimmed)) return 'python';
        if (/^(const |let |var |function |import |export |async |=>|interface |type |enum )/.test(trimmed)) return 'javascript';
        if (/^(public |private |protected |class |interface |package |import java)/.test(trimmed)) return 'java';
        if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/i.test(trimmed)) return 'sql';
        if (/^\w+:\s*(\n|$)/.test(trimmed) && !trimmed.includes('{') && trimmed.includes(':')) return 'yaml';
        if (/^[\[{]/.test(trimmed) && /[\]}]$/.test(trimmed)) return 'json';
        if (/^(#!\/|npm |yarn |pip |git |docker |kubectl |curl |wget |\$ )/.test(trimmed)) return 'bash';
        if (/^<(!DOCTYPE|html|head|body|div|span|p|a|script)/i.test(trimmed)) return 'html';
        if (/^(\.|#|@media|@import|\*|body|html)\s*{/.test(trimmed)) return 'css';
        return '';
    };

    const renderCodeBlock = (code, lang) => {
        const escaped = escapeHtml(code);
        if (lang) {
            return ['', `<syntaxhighlight lang="${lang}">`, escaped, '</syntaxhighlight>', ''];
        }
        return ['', '<pre>', escaped, '</pre>', ''];
    };

    const renderHeading = (text, level) => {
        const markers = '='.repeat(Math.min(Math.max(level, 1), 6));
        return ['', `${markers} ${text} ${markers}`, ''];
    };

    const getListPrefix = (depth, kind) => kind.repeat(depth + 1) + ' ';

    const parseTable = table => {
        const lines = ['{| class="wikitable"'];
        const headers = [];

        table.querySelectorAll('[role="columnheader"]').forEach(th => {
            const label = th.querySelector('[aria-label]');
            headers.push(escapeTableCell(label ? label.getAttribute('aria-label') : getTextContent(th) || ''));
        });

        if (headers.length) {
            lines.push('! ' + headers.join(' !! '));
        }

        table.querySelectorAll('tbody tr[data-rowid]').forEach(row => {
            if (row.dataset.rowid === 'HEADER_ROW_ID') return;
            const cells = [...row.querySelectorAll('[role="cell"]')]
                .map(cell => escapeTableCell(getTextContent(cell)));
            if (!cells.length) return;
            lines.push('|-');
            lines.push('| ' + cells.join(' || '));
        });

        lines.push('|}');
        return lines;
    };

    async function convertToMediaWiki() {
        const pages = [...document.querySelectorAll('.scriptor-pageFrame')].filter(p => !p.closest('table'));
        if (!pages.length) {
            alert('No Loop content found');
            return;
        }

        const lines = [];
        const processed = new Set();
        const codeTexts = new Set();
        const codeRawTexts = new Set();

        const title = getPageTitle(pages);
        if (title) {
            lines.push(`= ${title} =`, '');
        }

        pages.forEach(page => {
            page.querySelectorAll('.scriptor-paragraph, .scriptor-listItem, .scriptor-component-code-block, [role="table"], [role="heading"]').forEach(el => {
                if (processed.has(el)) return;

                const inTable = el.closest('table');
                if (inTable && inTable !== el) return;

                if (el.getAttribute('role') === 'table') {
                    const tableLines = parseTable(el);
                    if (tableLines.length) lines.push('', ...tableLines, '');
                    processed.add(el);
                    return;
                }

                if (el.classList.contains('scriptor-paragraph') && el.closest('.scriptor-component-code-block')) return;

                const codeBlock = el.querySelector('.scriptor-code-wrap-on') ||
                    (el.classList.contains('scriptor-component-code-block') ? el.querySelector('.scriptor-code-editor') : null);

                if (codeBlock) {
                    const code = [...codeBlock.querySelectorAll('.scriptor-paragraph')]
                        .map(p => p.textContent)
                        .join('\n')
                        .trim() || codeBlock.textContent.trim();
                    if (code) {
                        const lang = detectCodeLanguage(code, el);
                        lines.push(...renderCodeBlock(code, lang));
                        codeTexts.add(normalize(code));
                        codeRawTexts.add(code.replace(/\s+/g, ' ').trim());
                        codeBlock.querySelectorAll('.scriptor-paragraph').forEach(p => processed.add(p));
                        processed.add(el);
                    }
                    return;
                }

                const heading = el.getAttribute('role') === 'heading' ? el : el.querySelector('[role="heading"]');
                if (heading) {
                    const level = parseInt(heading.getAttribute('aria-level') || '1', 10);
                    const text = getTextContent(heading, true).replace(/'''/g, '').trim();
                    if (text) lines.push(...renderHeading(text, level));
                    processed.add(el);
                    return;
                }

                if (el.classList.contains('scriptor-listItem')) {
                    const li = el.querySelector('li');
                    if (!li) return;

                    const text = getTextContent(li);
                    if (!text) return;

                    const margin = parseInt((el.getAttribute('style') || '').match(/margin-left:\s*(\d+)/)?.[1] || 0, 10);
                    const depth = Math.max(0, Math.floor((margin - 27) / 27));
                    const checkbox = li.querySelector('.scriptor-listItem-marker-checkbox');
                    const checked = checkbox?.getAttribute('aria-checked') === 'true';
                    const listParent = li.closest('ol, ul');
                    const markerEl = el.querySelector('.scriptor-listItem-marker, [class*="listItem-marker"]');
                    const markerText = markerEl?.textContent?.trim() || '';
                    const hasNumberMarker = /^\d+[\.\)]?$/.test(markerText);
                    const dataListType = el.getAttribute('data-list-type') || el.closest('[data-list-type]')?.getAttribute('data-list-type');
                    const isOrdered = listParent?.tagName === 'OL' || hasNumberMarker || dataListType === 'ordered' || dataListType === 'number';
                    const prefix = getListPrefix(depth, isOrdered ? '#' : '*');
                    const itemText = checkbox ? `${formatCheckbox(checked)} ${text}` : text;
                    lines.push(prefix + itemText);
                    processed.add(el);
                    return;
                }

                if (!el.closest('.scriptor-listItem') && !el.querySelector('.scriptor-code-wrap-on')) {
                    let text = getTextContent(el, true);
                    el.querySelectorAll('a[href*="quip"]').forEach(link => {
                        const href = link.getAttribute('href');
                        if (href) {
                            text += ` ${formatExternalLink(link.textContent.trim() || href.split('/').pop(), href)}`;
                        }
                    });
                    text = normalize(text);
                    const isCodeDuplicate = [...codeTexts].some(c => c.includes(text) || text.includes(c)) ||
                        [...codeRawTexts].some(c => c.includes(text) || text.includes(c));
                    if (text && !isCodeDuplicate) lines.push('', text, '');
                    processed.add(el);
                }
            });
        });

        const wikitext = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        await copyToClipboard(wikitext);

        const note = document.createElement('div');
        note.textContent = '✓ MediaWiki copied!';
        note.style.cssText = 'position:fixed;top:20px;right:20px;background:#4CAF50;color:white;padding:12px 16px;border-radius:5px;z-index:10000;font-family:sans-serif';
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 2000);
    }

    const btn = document.createElement('button');
    btn.textContent = '📋 Copy as MediaWiki';
    btn.style.cssText = 'position:fixed;bottom:20px;left:20px;background:#3366CC;color:white;border:none;padding:8px 12px;border-radius:5px;cursor:pointer;z-index:10000;font-family:sans-serif;font-size:12px';
    btn.onclick = convertToMediaWiki;
    document.body.appendChild(btn);
})();
