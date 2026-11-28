use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, LogicalPosition, LogicalSize,
    Url, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri::webview::WebviewBuilder;

fn resolve_service_url(service: &str, custom_url: Option<String>) -> Result<(String, Url), String> {
    if let Some(ref custom) = custom_url {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            if let Ok(u) = Url::parse(trimmed) {
                return Ok(("사내 엔터프라이즈 AI".to_string(), u));
            }
        }
    }

    let (name, default_url) = match service.to_lowercase().as_str() {
        "gemini" => ("Google Gemini", "https://gemini.google.com/app"),
        "chatgpt" | "codex" => ("ChatGPT (Codex)", "https://chatgpt.com"),
        "claude" => ("Anthropic Claude", "https://claude.ai/new"),
        "enterprise" => ("사내 AI", "https://gemini.google.com/app"),
        _ => ("Google Gemini", "https://gemini.google.com/app"),
    };

    let url = Url::parse(default_url).map_err(|e| e.to_string())?;
    Ok((name.to_string(), url))
}

fn compute_snap_position_and_size(app: &AppHandle) -> Result<(PhysicalPosition<i32>, PhysicalSize<u32>), String> {
    let main = app.get_webview_window("main").ok_or("Main window not found")?;
    let main_pos = main.outer_position().map_err(|e| e.to_string())?;
    let main_size = main.outer_size().map_err(|e| e.to_string())?;

    let target_w = 520u32;
    let target_h = main_size.height;
    let mut target_x = main_pos.x + main_size.width as i32;
    let target_y = main_pos.y;

    if let Ok(Some(mon)) = main.current_monitor() {
        let mon_pos = mon.position();
        let mon_size = mon.size();
        let mon_right = mon_pos.x + mon_size.width as i32;
        let mon_left = mon_pos.x;

        if target_x + target_w as i32 > mon_right {
            let left_x = main_pos.x - target_w as i32;
            if left_x >= mon_left {
                target_x = left_x;
            } else {
                target_x = (mon_right - target_w as i32).max(mon_left);
            }
        }
    }

    Ok((PhysicalPosition::new(target_x, target_y), PhysicalSize::new(target_w, target_h)))
}

pub const AI_SELECTION_TRACKER_SCRIPT: &str = r#"
(function() {
    window.__geditor_last_selected_text = window.__geditor_last_selected_text || "";

    function domToMarkdown(node) {
        if (!node) return "";
        if (node.nodeType === 3) return node.nodeValue; // Node.TEXT_NODE
        if (node.nodeType !== 1) return ""; // Node.ELEMENT_NODE

        const tag = (node.tagName || "").toUpperCase();

        // KaTeX / Math support
        if (node.classList && (node.classList.contains('katex') || node.classList.contains('math'))) {
            const ann = node.querySelector('annotation[encoding*="tex"]');
            if (ann && ann.textContent) {
                const isBlock = node.classList.contains('katex-display') || tag === 'DIV';
                return isBlock ? "\n\n$$" + ann.textContent.trim() + "$$\n\n" : " $" + ann.textContent.trim() + "$ ";
            }
        }

        // Code block
        if (tag === 'PRE') {
            const codeEl = node.querySelector('code');
            let lang = '';
            if (codeEl) {
                const m = (codeEl.className || '').match(/language-(\w+)|lang-(\w+)/);
                if (m) lang = m[1] || m[2] || '';
            }
            const codeText = (codeEl || node).textContent || '';
            return "\n\n```" + lang + "\n" + codeText.replace(/\r\n/g, "\n").trim() + "\n```\n\n";
        }

        // Inline code
        if (tag === 'CODE') {
            if (node.parentElement && node.parentElement.tagName === 'PRE') {
                return node.textContent || '';
            }
            const text = node.textContent || '';
            return text ? " `" + text + "` " : "";
        }

        // Table formatting (GitHub Flavored Markdown)
        if (tag === 'TABLE') {
            return formatTableToMarkdown(node);
        }

        // Headings
        if (tag === 'H1') return "\n\n# " + childrenToMarkdown(node).trim() + "\n\n";
        if (tag === 'H2') return "\n\n## " + childrenToMarkdown(node).trim() + "\n\n";
        if (tag === 'H3') return "\n\n### " + childrenToMarkdown(node).trim() + "\n\n";
        if (tag === 'H4') return "\n\n#### " + childrenToMarkdown(node).trim() + "\n\n";
        if (tag === 'H5') return "\n\n##### " + childrenToMarkdown(node).trim() + "\n\n";
        if (tag === 'H6') return "\n\n###### " + childrenToMarkdown(node).trim() + "\n\n";

        // Bold & strong
        if (tag === 'STRONG' || tag === 'B') {
            const c = childrenToMarkdown(node).trim();
            return c ? "**" + c + "**" : "";
        }

        // Italics & emphasis
        if (tag === 'EM' || tag === 'I') {
            const c = childrenToMarkdown(node).trim();
            return c ? "*" + c + "*" : "";
        }

        // Strikethrough
        if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') {
            const c = childrenToMarkdown(node).trim();
            return c ? "~~" + c + "~~" : "";
        }

        // Blockquotes
        if (tag === 'BLOCKQUOTE') {
            const lines = childrenToMarkdown(node).trim().split('\n');
            return "\n\n" + lines.map(l => "> " + l).join('\n') + "\n\n";
        }

        // Lists
        if (tag === 'UL') {
            const lis = Array.from(node.children).filter(c => c.tagName === 'LI');
            if (lis.length === 0) return childrenToMarkdown(node);
            return "\n\n" + lis.map(li => "- " + childrenToMarkdown(li).trim()).join('\n') + "\n\n";
        }
        if (tag === 'OL') {
            const lis = Array.from(node.children).filter(c => c.tagName === 'LI');
            if (lis.length === 0) return childrenToMarkdown(node);
            return "\n\n" + lis.map((li, i) => (i + 1) + ". " + childrenToMarkdown(li).trim()).join('\n') + "\n\n";
        }
        if (tag === 'LI') {
            return childrenToMarkdown(node);
        }

        // Links
        if (tag === 'A') {
            const href = node.getAttribute('href') || '';
            const text = childrenToMarkdown(node).trim();
            if (!href) return text;
            return "[" + (text || href) + "](" + href + ")";
        }

        // Line break & separator
        if (tag === 'HR') return "\n\n---\n\n";
        if (tag === 'BR') return "\n";

        // Paragraphs
        if (tag === 'P') {
            const c = childrenToMarkdown(node).trim();
            return c ? "\n\n" + c + "\n\n" : "";
        }

        return childrenToMarkdown(node);
    }

    function childrenToMarkdown(parent) {
        let res = "";
        for (let i = 0; i < parent.childNodes.length; i++) {
            res += domToMarkdown(parent.childNodes[i]);
        }
        return res;
    }

    function formatTableToMarkdown(table) {
        const allTrs = Array.from(table.querySelectorAll('tr'));
        function cellText(cell) {
            let t = domToMarkdown(cell).trim().replace(/\r?\n+/g, " ").replace(/\|/g, "\\|");
            return t || " ";
        }

        let rows = allTrs.map(tr => {
            return Array.from(tr.querySelectorAll('th, td')).map(cellText);
        }).filter(r => r.length > 0);

        if (rows.length === 0) {
            const directCells = Array.from(table.querySelectorAll('th, td'));
            if (directCells.length > 0) {
                return "| " + directCells.map(cellText).join(" | ") + " |";
            }
            return "";
        }

        const maxCols = Math.max(...rows.map(r => r.length));
        if (maxCols === 0) return "";

        let headers = rows[0];
        while (headers.length < maxCols) headers.push(" ");

        const headerLine = "| " + headers.join(" | ") + " |";
        const sepLine = "| " + headers.map(() => "---").join(" | ") + " |";

        const bodyLines = rows.slice(1).map(row => {
            while (row.length < maxCols) row.push(" ");
            return "| " + row.join(" | ") + " |";
        });

        return "\n\n" + [headerLine, sepLine, ...bodyLines].join("\n") + "\n\n";
    }

    window.__geditor_get_selection_markdown = function() {
        try {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return "";
            if (sel.isCollapsed && sel.toString().trim().length === 0) return "";

            const range = sel.getRangeAt(0);

            // If selection is inside PRE/CODE, extract pure code block
            let container = range.commonAncestorContainer;
            let el = container.nodeType === 1 ? container : container.parentElement;
            while (el && el !== document.body) {
                if (el.tagName === 'PRE') {
                    const codeText = sel.toString();
                    const codeEl = el.querySelector('code');
                    let lang = '';
                    if (codeEl) {
                        const m = (codeEl.className || '').match(/language-(\w+)|lang-(\w+)/);
                        if (m) lang = m[1] || m[2] || '';
                    }
                    return "```" + lang + "\n" + codeText.replace(/\r\n/g, "\n").trim() + "\n```";
                }
                el = el.parentElement;
            }

            const fragment = range.cloneContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);

            // Table check
            if (tempDiv.querySelector('table')) {
                return domToMarkdown(tempDiv).trim().replace(/\n{3,}/g, "\n\n");
            } else if (tempDiv.querySelector('tr, td, th')) {
                const wrapTable = document.createElement('table');
                wrapTable.innerHTML = tempDiv.innerHTML;
                return domToMarkdown(wrapTable).trim().replace(/\n{3,}/g, "\n\n");
            }

            const md = domToMarkdown(tempDiv).trim().replace(/\n{3,}/g, "\n\n");
            if (md && md.length > 0) return md;

            return sel.toString();
        } catch (e) {
            return window.getSelection() ? window.getSelection().toString() : "";
        }
    };

    window.__geditor_dom_to_markdown = domToMarkdown;

    function findInputField(root) {
        if (!root) return null;
        const selectors = [
            'rich-textarea .ql-editor',
            'rich-textarea div[contenteditable="true"]',
            '#prompt-textarea',
            'div.ProseMirror[contenteditable="true"]',
            'div[contenteditable="true"][role="textbox"]',
            'fieldset div[contenteditable="true"]',
            'div[contenteditable="true"]',
            'textarea:not([disabled])',
            'input[type="text"]:not([disabled])'
        ];

        for (const sel of selectors) {
            try {
                const els = root.querySelectorAll(sel);
                for (const el of els) {
                    if (el && (el.offsetParent !== null || el.offsetHeight > 0 || window.getComputedStyle(el).display !== 'none')) {
                        return el;
                    }
                }
            } catch (e) {}
        }

        try {
            const all = root.querySelectorAll('*');
            for (const el of all) {
                if (el.shadowRoot) {
                    const found = findInputField(el.shadowRoot);
                    if (found) return found;
                }
            }
        } catch (e) {}

        return null;
    }

    function wakeUpElement(target) {
        if (!target) return;
        try {
            window.focus();
            target.focus();
            const rect = target.getBoundingClientRect();
            const clientX = rect.left + Math.min(20, Math.max(5, rect.width / 2));
            const clientY = rect.top + Math.min(20, Math.max(5, rect.height / 2));
            const opts = {
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window,
                clientX: clientX,
                clientY: clientY,
                pointerId: 1
            };
            target.dispatchEvent(new PointerEvent('pointerdown', opts));
            target.dispatchEvent(new MouseEvent('mousedown', opts));
            target.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
            target.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            target.dispatchEvent(new PointerEvent('pointerup', opts));
            target.dispatchEvent(new MouseEvent('mouseup', opts));
            target.dispatchEvent(new MouseEvent('click', opts));
        } catch(e) {}
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function injectPromptText(target, text) {
        if (!target) return false;
        wakeUpElement(target);

        if (target.isContentEditable) {
            target.classList.remove('ql-blank');
            target.focus();

            // 1. Synthetic ClipboardEvent ('paste') with DataTransfer
            // This is the native, framework-supported way to paste multiline content into Quill and contenteditable
            try {
                const dt = new DataTransfer();
                dt.setData('text/plain', text);
                const html = text.split('\n').map(l => l.length > 0 ? `<p>${escapeHtml(l)}</p>` : '<p><br></p>').join('');
                dt.setData('text/html', html);
                const pasteEvt = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clipboardData: dt,
                    view: window
                });
                target.dispatchEvent(pasteEvt);
            } catch(pe) {}

            let cur = (target.innerText || target.textContent || '').trim();

            // 2. Direct DOM paragraph injection fallback if paste was not handled (e.g. text too short or empty)
            if (cur.length < text.trim().length * 0.7) {
                const paragraphs = text.split('\n');
                target.innerHTML = paragraphs.map(p => p.length > 0 ? '<p>' + escapeHtml(p) + '</p>' : '<p><br></p>').join('');
                target.classList.remove('ql-blank');
            }

            // 3. Quill setText synchronization if Quill is detected on the element
            try {
                const q = target.__quill || target.parentElement?.__quill || target.closest('.ql-container')?.__quill || target.closest('rich-textarea')?.__quill;
                if (q && typeof q.setText === 'function') {
                    const curText = (target.innerText || target.textContent || '').trim();
                    if (curText.length < text.trim().length * 0.7) {
                        q.setText(text, 'user');
                    }
                }
            } catch(qe) {}
        } else if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            target.select();
            try {
                document.execCommand('insertText', false, text);
            } catch(ee) {}
            if (target.value !== text) {
                const proto = target.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (setter) {
                    setter.call(target, text);
                } else {
                    target.value = text;
                }
            }
        }

        // Dispatch input events with composed: true so Angular / Quill listeners trigger
        try {
            target.dispatchEvent(new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                composed: true,
                inputType: 'insertFromPaste',
                data: text
            }));
            target.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                composed: true,
                inputType: 'insertFromPaste',
                data: text
            }));
            target.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            target.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

            const rich = target.closest('rich-textarea') || target.closest('.input-area');
            if (rich) {
                rich.classList.remove('ql-blank');
                rich.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                rich.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            }
        } catch(e) {}

        wakeUpElement(target);
        return true;
    }

    function findSendButton(root) {
        if (!root) return null;
        const selectors = [
            'button.send-button',
            'button[aria-label*="Send"]',
            'button[aria-label*="보내기"]',
            'button[aria-label*="전송"]',
            'button[aria-label*="제출"]',
            'button[aria-label*="프롬프트"]',
            'button[aria-label*="Submit"]',
            'button[aria-label*="Prompt"]',
            'button[data-testid="send-button"]',
            '.send-button-container button',
            'button.mat-mdc-icon-button[aria-label*="Send"]',
            'button.mat-mdc-icon-button[aria-label*="보내기"]',
            'button.mat-mdc-icon-button[aria-label*="전송"]',
            'button.mat-mdc-icon-button[aria-label*="제출"]',
            'button[mattooltip*="Send"]',
            'button[mattooltip*="보내기"]',
            'button[mattooltip*="전송"]',
            'button[mattooltip*="제출"]',
            'div[role="button"][aria-label*="Send"]',
            'div[role="button"][aria-label*="보내기"]',
            'div[role="button"][aria-label*="전송"]',
            'div[role="button"][aria-label*="제출"]',
            'button.send-button-container',
            '.input-area-container button.send-button',
            '.bottom-container button.send-button',
            'button[type="submit"]',
            'fieldset button:last-child'
        ];

        for (const sel of selectors) {
            try {
                const els = root.querySelectorAll(sel);
                for (const el of els) {
                    if (el.offsetParent !== null || el.offsetHeight > 0 || window.getComputedStyle(el).display !== 'none') {
                        return el;
                    }
                }
            } catch (e) {}
        }

        try {
            const all = root.querySelectorAll('*');
            for (const el of all) {
                if (el.shadowRoot) {
                    const found = findSendButton(el.shadowRoot);
                    if (found) return found;
                }
            }
        } catch (e) {}

        return null;
    }

    function dismissScrims() {
        try {
            const scrims = document.querySelectorAll('.scrim, .chat-history-scrim, .full-screen-scrim, [class*="scrim"], [class*="backdrop"], .cdk-overlay-backdrop, mat-drawer-backdrop');
            for (const s of scrims) {
                if (!s.closest('mat-dialog-container, [role="dialog"], [role="alertdialog"]')) {
                    s.style.display = 'none';
                    s.style.opacity = '0';
                    s.style.pointerEvents = 'none';
                }
            }
        } catch(e) {}
    }

    function triggerClick(el) {
        if (!el) return;
        try {
            el.focus();
            const rect = el.getBoundingClientRect();
            const clientX = rect.left + Math.min(15, Math.max(5, rect.width / 2));
            const clientY = rect.top + Math.min(15, Math.max(5, rect.height / 2));
            const opts = {
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window,
                clientX: clientX,
                clientY: clientY,
                pointerId: 1
            };
            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
            el.click();
        } catch(e) {
            try { el.click(); } catch(e2) {}
        }
    }

    function triggerEnter(el) {
        if (!el) return;
        try {
            el.focus();
            const evInit = {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window
            };
            el.dispatchEvent(new KeyboardEvent('keydown', evInit));
            el.dispatchEvent(new KeyboardEvent('keypress', evInit));
            el.dispatchEvent(new KeyboardEvent('keyup', evInit));
        } catch(e) {}
    }

    function submitPromptOnce(targetInput) {
        if (!targetInput) return false;
        wakeUpElement(targetInput);

        const sendBtn = findSendButton(document);
        if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
            triggerClick(sendBtn);
            dismissScrims();
            return true;
        }

        if (sendBtn) {
            triggerClick(sendBtn);
            setTimeout(function() {
                const target = findInputField(document) || targetInput;
                const len = target ? (target.innerText || target.value || '').trim().length : 0;
                if (len > 0) {
                    triggerEnter(target);
                }
            }, 120);
            dismissScrims();
            return true;
        }

        triggerEnter(targetInput);
        dismissScrims();
        return true;
    }

    function isStopOrGeneratingPresent() {
        const stopSelectors = [
            'button[aria-label*="Stop"]',
            'button[aria-label*="중지"]',
            'button[aria-label*="중단"]',
            'button[data-testid="stop-button"]',
            'button.stop-button',
            '.stop-icon',
            '[data-is-streaming="true"]',
            '.result-streaming',
            '.streaming',
            'mat-progress-spinner'
        ];
        for (const sel of stopSelectors) {
            try {
                const el = document.querySelector(sel);
                if (el && (el.offsetParent !== null || el.offsetHeight > 0)) {
                    return true;
                }
            } catch(e) {}
        }
        return false;
    }

    function getAllAssistantMessages() {
        const msgSelectors = [
            'message-content',
            'model-response',
            'div[data-test-id="model-response"]',
            'div.model-response-text',
            '.response-container',
            'div[data-message-author-role="assistant"]',
            '.font-claude-message',
            '[data-role="assistant"]',
            '.chat-message.assistant',
            '.bot-message',
            '.agent-turn'
        ];
        for (const sel of msgSelectors) {
            try {
                const list = document.querySelectorAll(sel);
                if (list.length > 0) {
                    return Array.from(list);
                }
            } catch (e) {}
        }
        const mdList = document.querySelectorAll('.markdown');
        return Array.from(mdList);
    }

    window.__geditor_start_inline_ai = function(text) {
        dismissScrims();

        // Tag all existing assistant messages so they are NEVER returned as the new answer!
        const existingMsgs = getAllAssistantMessages();
        existingMsgs.forEach(el => el.setAttribute('data-geditor-historical', 'true'));
        const oldCount = existingMsgs.length;
        const oldLastMsg = oldCount > 0 ? existingMsgs[oldCount - 1] : null;
        const oldLastText = oldLastMsg ? (oldLastMsg.innerText || oldLastMsg.textContent || '').trim() : '';

        window.__geditor_ai_state = {
            status: 'submitting',
            submitDispatched: false,
            submitCount: 0,
            submitted: false,
            textInjected: false,
            promptText: text,
            startTime: Date.now(),
            submitTimestamp: 0,
            oldCount: oldCount,
            oldLastText: oldLastText,
            lastTextLength: 0,
            lastChangeTime: Date.now(),
            resultMarkdown: null,
            error: null
        };

        const target = findInputField(document);
        if (!target) {
            window.__geditor_ai_state.status = 'error';
            window.__geditor_ai_state.error = 'AI 입력 필드를 찾을 수 없습니다.';
            return JSON.stringify(window.__geditor_ai_state);
        }

        // 1. Inject prompt text with full Quill / Clipboard / DOM synchronization
        injectPromptText(target, text);
        window.__geditor_ai_state.textInjected = true;

        // 2. Submit ONCE after a brief delay allowing Angular/Quill to update state
        setTimeout(function() {
            if (!window.__geditor_ai_state || window.__geditor_ai_state.submitDispatched) return;
            const targetEl = findInputField(document) || target;
            submitPromptOnce(targetEl);
            window.__geditor_ai_state.submitDispatched = true;
            window.__geditor_ai_state.submitCount = 1;
            window.__geditor_ai_state.submitTimestamp = Date.now();
            dismissScrims();
        }, 250);

        return JSON.stringify(window.__geditor_ai_state);
    };

    window.__geditor_check_inline_ai_status = function() {
        if (!window.__geditor_ai_state) {
            return JSON.stringify({ status: 'error', error: 'AI 상태가 초기화되지 않았습니다.' });
        }
        const state = window.__geditor_ai_state;
        if (state.status === 'done' || state.status === 'error') {
            return JSON.stringify(state);
        }

        const now = Date.now();
        const elapsed = now - state.startTime;

        // 1. Check if the submission was accepted
        if (!state.submitted) {
            const target = findInputField(document);
            const inputLen = target ? (target.innerText || target.value || '').trim().length : 0;
            const isStopPresent = isStopOrGeneratingPresent();

            const allMsgs = getAllAssistantMessages();
            const newMsgs = allMsgs.filter(el => !el.hasAttribute('data-geditor-historical'));

            if (isStopPresent || newMsgs.length > 0 || allMsgs.length > state.oldCount) {
                state.submitted = true;
                state.status = 'generating';
                state.lastChangeTime = now;
                dismissScrims();
            } else if (state.submitDispatched && inputLen === 0 && (now - state.submitTimestamp) > 300) {
                state.submitted = true;
                state.status = 'generating';
                state.lastChangeTime = now;
                dismissScrims();
            } else {
                // Safety single retry ONLY if 4 seconds have passed since submitDispatched and input is still holding full text
                if (state.submitDispatched && state.submitCount < 2 && (now - state.submitTimestamp) > 4000 && inputLen > 0) {
                    submitPromptOnce(target);
                    state.submitCount = 2;
                    state.submitTimestamp = now;
                    dismissScrims();
                }

                if (elapsed > 20000 && !state.submitDispatched) {
                    state.status = 'error';
                    state.error = 'AI 전송 버튼 클릭에 실패했습니다. AI 패널 상태를 확인해 주세요.';
                    return JSON.stringify(state);
                }
                return JSON.stringify({ status: 'submitting', elapsed: Math.round(elapsed / 1000) });
            }
        }

        // 2. Identify the NEW response message (must NOT be historical!)
        const allMsgs = getAllAssistantMessages();
        const newMsgs = allMsgs.filter(el => !el.hasAttribute('data-geditor-historical'));

        let curMsg = null;
        let curLength = 0;

        if (newMsgs.length > 0) {
            curMsg = newMsgs[newMsgs.length - 1];
            curLength = (curMsg.innerText || curMsg.textContent || '').trim().length;
        } else if (allMsgs.length > state.oldCount) {
            curMsg = allMsgs[allMsgs.length - 1];
            curLength = (curMsg.innerText || curMsg.textContent || '').trim().length;
        } else if (allMsgs.length === state.oldCount && allMsgs.length > 0) {
            const candidate = allMsgs[allMsgs.length - 1];
            const candText = (candidate.innerText || candidate.textContent || '').trim();
            // ONLY if text is DIFFERENT from the old text!
            if (candText !== state.oldLastText && candText.length > 5) {
                curMsg = candidate;
                curLength = candText.length;
            }
        }

        // If the new response hasn't started yet:
        if (!curMsg || curLength === 0) {
            if (elapsed > 45000) {
                state.status = 'error';
                state.error = 'AI 응답 시작을 감지하지 못했습니다 (45초 초과).';
                return JSON.stringify(state);
            }
            return JSON.stringify({
                status: 'waiting_for_tokens',
                elapsed: Math.round(elapsed / 1000)
            });
        }

        // 3. Track response generation
        if (curLength > state.lastTextLength) {
            state.lastTextLength = curLength;
            state.lastChangeTime = now;
            state.status = 'generating';
        }

        const isGenerating = isStopOrGeneratingPresent();
        const quietDuration = now - state.lastChangeTime;

        // 4. Completion: new text has >= 2 chars, stop button is gone, quiet for 1.2s
        if (curLength >= 2 && !isGenerating && quietDuration >= 1200) {
            state.status = 'done';
            if (typeof window.__geditor_dom_to_markdown === 'function') {
                state.resultMarkdown = window.__geditor_dom_to_markdown(curMsg).trim();
            } else {
                state.resultMarkdown = (curMsg.innerText || curMsg.textContent || '').trim();
            }
            return JSON.stringify(state);
        }

        if (elapsed > 120000) {
            if (state.lastTextLength > 10) {
                state.status = 'done';
                state.resultMarkdown = typeof window.__geditor_dom_to_markdown === 'function'
                    ? window.__geditor_dom_to_markdown(curMsg).trim()
                    : (curMsg.innerText || '').trim();
            } else {
                state.status = 'error';
                state.error = 'AI 응답 시간 초과 (120초)';
            }
            return JSON.stringify(state);
        }

        return JSON.stringify({
            status: 'generating',
            length: curLength,
            elapsed: Math.round(elapsed / 1000)
        });
    };

    function recordSelection() {
        try {
            const text = window.__geditor_get_selection_markdown();
            if (text && text.trim().length > 0) {
                window.__geditor_last_selected_text = text;
            }
        } catch(e) {}
    }

    // Capture selections continuously on user interactions (installed only once)
    if (!window.__geditor_tracker_listeners_installed) {
        window.__geditor_tracker_listeners_installed = true;
        document.addEventListener('selectionchange', recordSelection, true);
        window.addEventListener('mouseup', recordSelection, true);
        window.addEventListener('keyup', recordSelection, true);
        window.addEventListener('touchend', recordSelection, true);
        window.addEventListener('copy', recordSelection, true);

        // Continuous interval check to capture drag selections before blur
        setInterval(recordSelection, 250);
    }
})();
"#;

/// Show or create AI Side Panel as child webview on main window
#[tauri::command]
pub async fn show_ai_panel(
    app: AppHandle,
    service: Option<String>,
    custom_url: Option<String>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let main_win = app.get_window("main").ok_or("Main window not found")?;

    let svc = service.unwrap_or_else(|| "gemini".to_string());
    let (_name, target_url) = resolve_service_url(&svc, custom_url)?;

    let pos = LogicalPosition::new(x, y);
    let size = LogicalSize::new(width.max(20.0), height.max(20.0));

    if let Some(webview) = app.get_webview("ai-panel") {
        let _ = webview.set_position(pos);
        let _ = webview.set_size(size);
        let _ = webview.show();

        if let Ok(curr) = webview.url() {
            let curr_str = curr.as_str();
            let target_str = target_url.as_str();
            if curr_str != target_str && !curr_str.starts_with(target_str) && !target_str.starts_with(curr_str) {
                let _ = webview.navigate(target_url);
            }
        }
        let _ = webview.eval(AI_SELECTION_TRACKER_SCRIPT);
    } else {
        let builder = WebviewBuilder::new(
            "ai-panel",
            WebviewUrl::External(target_url),
        )
        .initialization_script(AI_SELECTION_TRACKER_SCRIPT);
        main_win.add_child(builder, pos, size).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Hide AI Side Panel
#[tauri::command]
pub async fn hide_ai_panel(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview("ai-panel") {
        let _ = webview.hide();
    }
    Ok(())
}

/// Update AI Side Panel position and size
#[tauri::command]
pub async fn update_ai_panel_bounds(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview("ai-panel") {
        let _ = webview.set_position(LogicalPosition::new(x, y));
        let _ = webview.set_size(LogicalSize::new(width.max(20.0), height.max(20.0)));
    }
    Ok(())
}

/// Get currently selected text or code from AI webview (Panel or Floating Window)
#[tauri::command]
pub async fn get_ai_selected_text(app: AppHandle) -> Result<String, String> {
    // 1. Try ai-panel first, then ai-assistant window
    let webview = if let Some(panel) = app.get_webview("ai-panel") {
        panel
    } else if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        ai_win.as_ref().clone()
    } else {
        return Err("AI 도우미가 열려있지 않습니다.".to_string());
    };

    let (tx, rx) = tokio::sync::oneshot::channel();
    let tx_arc = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
    let tx_clone = tx_arc.clone();

    let script = r#"
        (function() {
            try {
                // 1. Check live window selection with Markdown formatting
                if (typeof window.__geditor_get_selection_markdown === 'function') {
                    const md = window.__geditor_get_selection_markdown();
                    if (md && md.trim().length > 0) {
                        window.__geditor_last_selected_text = md;
                        return md;
                    }
                }

                // 2. Check previously tracked selection (survives blur & window focus shifts!)
                if (window.__geditor_last_selected_text && window.__geditor_last_selected_text.trim().length > 0) {
                    return window.__geditor_last_selected_text;
                }

                // 3. Check active input / textarea selection
                const act = document.activeElement;
                if (act && (act.tagName === 'TEXTAREA' || act.tagName === 'INPUT')) {
                    const s = act.value.substring(act.selectionStart, act.selectionEnd);
                    if (s && s.trim().length > 0) {
                        window.__geditor_last_selected_text = s;
                        return s;
                    }
                }

                // 4. Fallback: check if any code block exists in AI response
                const codeSelectors = [
                    'pre code',
                    'code-block pre',
                    '.markdown pre code',
                    'pre',
                    '[data-message-author-role="assistant"] pre',
                    '.response-container pre'
                ];
                for (const selStr of codeSelectors) {
                    const codes = document.querySelectorAll(selStr);
                    if (codes.length > 0) {
                        const lastCode = codes[codes.length - 1];
                        const ct = lastCode.innerText || lastCode.textContent || "";
                        if (ct && ct.trim().length > 0) return ct;
                    }
                }

                return "";
            } catch (e) {
                return window.__geditor_last_selected_text || "";
            }
        })()
    "#;

    webview.eval_with_callback(script, move |result| {
        if let Ok(mut lock) = tx_clone.lock() {
            if let Some(sender) = lock.take() {
                let _ = sender.send(result);
            }
        }
    }).map_err(|e| e.to_string())?;

    let res = match tokio::time::timeout(tokio::time::Duration::from_millis(2000), rx).await {
        Ok(Ok(s)) => s,
        _ => "".to_string(),
    };

    let cleaned: String = serde_json::from_str(&res).unwrap_or(res);
    Ok(cleaned)
}

/// Reload AI webview
#[tauri::command]
pub async fn reload_ai_panel(app: AppHandle) -> Result<(), String> {
    if let Some(panel) = app.get_webview("ai-panel") {
        let _ = panel.reload();
    } else if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        let _ = ai_win.reload();
    }
    Ok(())
}

/// Navigate AI webview to a specific URL
#[tauri::command]
pub async fn navigate_ai_panel(app: AppHandle, url: String) -> Result<(), String> {
    let parsed_url = Url::parse(&url).map_err(|e| e.to_string())?;
    if let Some(panel) = app.get_webview("ai-panel") {
        let _ = panel.navigate(parsed_url);
        let _ = panel.eval(AI_SELECTION_TRACKER_SCRIPT);
    } else if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        let _ = ai_win.navigate(parsed_url);
        let _ = ai_win.eval(AI_SELECTION_TRACKER_SCRIPT);
    }
    Ok(())
}

/// Standalone Window Support
#[tauri::command]
pub async fn open_ai_assistant(
    app: AppHandle,
    service: String,
    custom_url: Option<String>,
    snap: Option<bool>,
) -> Result<(), String> {
    let (name, url) = resolve_service_url(&service, custom_url)?;
    let win_title = format!("Geditor AI 도우미 - {}", name);

    if let Some(window) = app.get_webview_window("ai-assistant") {
        let _ = window.set_title(&win_title);
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        let _ = window.navigate(url);
        let _ = window.eval(AI_SELECTION_TRACKER_SCRIPT);

        if snap.unwrap_or(false) {
            let _ = snap_ai_assistant(app).await;
        }
    } else {
        let (pos, size) = compute_snap_position_and_size(&app).unwrap_or_else(|_| {
            (PhysicalPosition::new(100, 100), PhysicalSize::new(520, 850))
        });

        let builder = WebviewWindowBuilder::new(
            &app,
            "ai-assistant",
            WebviewUrl::External(url),
        )
        .title(&win_title)
        .position(pos.x as f64, pos.y as f64)
        .inner_size(size.width as f64, size.height as f64)
        .min_inner_size(380.0, 450.0)
        .initialization_script(AI_SELECTION_TRACKER_SCRIPT);

        let window = builder.build().map_err(|e| e.to_string())?;

        let win_clone = window.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = win_clone.hide();
            }
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn toggle_ai_assistant(
    app: AppHandle,
    service: Option<String>,
    custom_url: Option<String>,
) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("ai-assistant") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
            return Ok(false);
        }
    }

    let svc = service.unwrap_or_else(|| "gemini".to_string());
    open_ai_assistant(app, svc, custom_url, Some(false)).await?;
    Ok(true)
}

#[tauri::command]
pub async fn snap_ai_assistant(app: AppHandle) -> Result<(), String> {
    let ai_win = app.get_webview_window("ai-assistant").ok_or("AI Assistant window not found")?;
    let (pos, size) = compute_snap_position_and_size(&app)?;

    ai_win.set_size(size).map_err(|e| e.to_string())?;
    ai_win.set_position(pos).map_err(|e| e.to_string())?;
    ai_win.show().map_err(|e| e.to_string())?;
    ai_win.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn set_ai_assistant_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        ai_win.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ask_ai_with_prompt(
    app: AppHandle,
    prompt: String,
    _service: Option<String>,
) -> Result<(), String> {
    // 1. Write prompt to native clipboard as backup
    let _ = crate::clipboard_cmd::write_clipboard_text(prompt.clone());

    // 2. Prepare injection script
    let encoded_prompt = serde_json::to_string(&prompt).unwrap_or_else(|_| format!("\"{}\"", prompt));
    let script = format!(
        r#"
        (function() {{
            const text = {};
            let attempts = 0;
            const maxAttempts = 35;

            function findInputField(root) {{
                if (!root) return null;
                const selectors = [
                    '#prompt-textarea',
                    'rich-textarea div[contenteditable="true"]',
                    'rich-textarea .ql-editor',
                    'rich-textarea p',
                    'div.ProseMirror[contenteditable="true"]',
                    'div[contenteditable="true"][role="textbox"]',
                    'fieldset div[contenteditable="true"]',
                    'div[contenteditable="true"]',
                    'textarea:not([disabled])',
                    'input[type="text"]:not([disabled])'
                ];

                for (const sel of selectors) {{
                    try {{
                        const el = root.querySelector(sel);
                        if (el && (el.offsetParent !== null || el.offsetHeight > 0 || window.getComputedStyle(el).display !== 'none')) {{
                            return el;
                        }}
                    }} catch (e) {{}}
                }}

                // Search shadow roots recursively
                try {{
                    const all = root.querySelectorAll('*');
                    for (const el of all) {{
                        if (el.shadowRoot) {{
                            const found = findInputField(el.shadowRoot);
                            if (found) return found;
                        }}
                    }}
                }} catch (e) {{}}

                return null;
            }}

            function tryInject() {{
                attempts++;
                const target = findInputField(document);

                if (target) {{
                    target.focus();
                    let inserted = false;
                    try {{
                        if (target.isContentEditable) {{
                            const sel = window.getSelection();
                            const range = document.createRange();
                            range.selectNodeContents(target);
                            if (sel) {{
                                sel.removeAllRanges();
                                sel.addRange(range);
                            }}
                            inserted = document.execCommand('insertText', false, text);
                            if (!inserted) {{
                                target.innerText = text;
                                target.dispatchEvent(new InputEvent('beforeinput', {{
                                    bubbles: true,
                                    cancelable: true,
                                    inputType: 'insertText',
                                    data: text
                                }}));
                                target.dispatchEvent(new InputEvent('input', {{
                                    bubbles: true,
                                    inputType: 'insertText',
                                    data: text
                                }}));
                            }}
                        }} else if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {{
                            target.select();
                            inserted = document.execCommand('insertText', false, text);
                            if (!inserted || target.value !== text) {{
                                const proto = target.tagName === 'TEXTAREA'
                                    ? window.HTMLTextAreaElement.prototype
                                    : window.HTMLInputElement.prototype;
                                const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                                if (setter) {{
                                    setter.call(target, text);
                                }} else {{
                                    target.value = text;
                                }}
                            }}
                        }}
                    }} catch (e) {{
                        console.error('Text insertion failed:', e);
                    }}

                    target.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    target.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }}

                if (attempts < maxAttempts) {{
                    setTimeout(tryInject, 200);
                }}
                return false;
            }}

            tryInject();
        }})();
        "#,
        encoded_prompt
    );

    // 3. Inject with retries into ai-panel and ai-assistant window
    let app_clone = app.clone();
    let script_clone = script.clone();
    tokio::spawn(async move {
        for delay in [0, 120, 350, 800, 1500, 2500] {
            if delay > 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
            }
            if let Some(panel) = app_clone.get_webview("ai-panel") {
                let _ = panel.set_focus();
                let _ = panel.eval(&script_clone);
            }
            if let Some(ai_win) = app_clone.get_webview_window("ai-assistant") {
                let _ = ai_win.show();
                let _ = ai_win.set_focus();
                let _ = ai_win.eval(&script_clone);
            }
        }
    });

    Ok(())
}

/// Execute inline AI prompt: injects prompt into AI webview, triggers generation,
/// monitors streaming completion, and extracts the resulting markdown text.
#[tauri::command]
pub async fn execute_inline_ai_prompt(
    app: AppHandle,
    prompt: String,
    selected_text: Option<String>,
) -> Result<String, String> {
    let webview = if let Some(panel) = app.get_webview("ai-panel") {
        panel
    } else if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        ai_win.as_ref().clone()
    } else {
        return Err("AI 도우미 패널이 준비되지 않았습니다. AI 패널을 먼저 열어주세요.".to_string());
    };

    // Give focus to the webview window so that the browser removes inactive/blur dimming
    let _ = webview.set_focus();

    // Ensure the tracker and inline script are active in the webview
    let _ = webview.eval(AI_SELECTION_TRACKER_SCRIPT);

    let final_prompt = match selected_text {
        Some(ref text) if !text.trim().is_empty() => {
            format!(
                "[사용자 지시사항] {}\n\n[참조 본문 내용]\n{}\n\n[작성 지침]\n- 위 내용과 사용자 지시사항에 따라 최종 결과 텍스트(또는 마크다운)만 출력하세요.\n- 인사말, 서두(예: '네, 작성해 드렸습니다'), 맺음말 등 부연 설명은 일절 생략하고, 에디터 본문에 바로 교체/삽입될 완성된 내용만 작성해 주세요.",
                prompt.trim(),
                text.trim()
            )
        }
        _ => {
            format!(
                "[사용자 지시사항] {}\n\n[작성 지침]\n- 위 사용자 지시사항에 따라 필요한 텍스트 또는 마크다운(코드)을 바로 작성하세요.\n- 인사말, 서두, 맺음말 등 부연 설명은 일절 생략하고, 에디터 본문에 바로 삽입될 완성된 내용만 작성해 주세요.",
                prompt.trim()
            )
        }
    };

    // 1. Write final prompt to native system clipboard as fallback/paste source
    let _ = crate::clipboard_cmd::write_clipboard_text(final_prompt.clone());

    // 2. Active focus retries to ensure macOS Cocoa firstResponder activates the AI panel
    let app_clone = app.clone();
    tokio::spawn(async move {
        for delay in [0, 60, 150, 350, 800, 1500] {
            if delay > 0 {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
            }
            if let Some(panel) = app_clone.get_webview("ai-panel") {
                let _ = panel.set_focus();
            }
            if let Some(ai_win) = app_clone.get_webview_window("ai-assistant") {
                let _ = ai_win.set_focus();
            }
        }
    });

    let encoded_prompt = serde_json::to_string(&final_prompt).unwrap_or_else(|_| format!("\"{}\"", final_prompt));

    let start_script = format!(
        r#"
        (function() {{
            try {{
                if (typeof window.__geditor_start_inline_ai === 'function') {{
                    return window.__geditor_start_inline_ai({});
                }} else {{
                    return JSON.stringify({{ status: "error", error: "AI 스크립트가 로드되지 않았습니다." }});
                }}
            }} catch(e) {{
                return JSON.stringify({{ status: "error", error: e.toString() }});
            }}
        }})()
        "#,
        encoded_prompt
    );

    webview.eval(&start_script).map_err(|e| e.to_string())?;

    let start_time = std::time::Instant::now();
    let max_duration = std::time::Duration::from_secs(120);

    loop {
        if start_time.elapsed() > max_duration {
            return Err("AI 응답 대기 시간이 초과되었습니다 (120초).".to_string());
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(350)).await;

        let (tx, rx) = tokio::sync::oneshot::channel();
        let tx_arc = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
        let tx_clone = tx_arc.clone();

        let check_script = r#"
            (function() {
                try {
                    if (typeof window.__geditor_check_inline_ai_status === 'function') {
                        return window.__geditor_check_inline_ai_status();
                    }
                    return JSON.stringify({ status: "submitting", elapsed: 0, waiting_for_script: true });
                } catch(e) {
                    return JSON.stringify({ status: "error", error: e.toString() });
                }
            })()
        "#;

        if let Err(e) = webview.eval_with_callback(check_script, move |result| {
            if let Ok(mut lock) = tx_clone.lock() {
                if let Some(sender) = lock.take() {
                    let _ = sender.send(result);
                }
            }
        }) {
            return Err(e.to_string());
        }

        let raw_res = match tokio::time::timeout(tokio::time::Duration::from_millis(2000), rx).await {
            Ok(Ok(s)) => s,
            _ => continue,
        };

        let json_str: String = serde_json::from_str(&raw_res).unwrap_or(raw_res);
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
            if val.get("waiting_for_script").and_then(|v| v.as_bool()).unwrap_or(false) {
                if start_time.elapsed() > std::time::Duration::from_millis(1500) {
                    let _ = webview.eval(AI_SELECTION_TRACKER_SCRIPT);
                }
            }
            let status = val.get("status").and_then(|v| v.as_str()).unwrap_or("");
            if status == "done" {
                let markdown = val.get("resultMarkdown")
                    .or_else(|| val.get("markdown"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                return Ok(markdown);
            } else if status == "error" {
                let err = val.get("error")
                    .and_then(|v| v.as_str())
                    .unwrap_or("AI 응답 처리 중 오류가 발생했습니다.")
                    .to_string();
                return Err(err);
            } else if status == "submitting" {
                let _ = webview.set_focus();
            }
        }
    }
}

/// Cancel active inline AI generation in webview
#[tauri::command]
pub async fn cancel_inline_ai(app: AppHandle) -> Result<(), String> {
    let script = r#"
        (function() {
            try {
                if (window.__geditor_ai_state) {
                    window.__geditor_ai_state.status = 'error';
                    window.__geditor_ai_state.error = '사용자에 의해 취소되었습니다.';
                }
                const stopSelectors = [
                    'button[aria-label*="Stop"]',
                    'button[aria-label*="중지"]',
                    'button[aria-label*="중단"]',
                    'button[data-testid="stop-button"]',
                    'button.stop-button'
                ];
                for (const sel of stopSelectors) {
                    const el = document.querySelector(sel);
                    if (el && (el.offsetParent !== null || el.offsetHeight > 0)) {
                        el.click();
                        break;
                    }
                }
            } catch(e) {}
        })()
    "#;
    if let Some(panel) = app.get_webview("ai-panel") {
        let _ = panel.eval(script);
    }
    if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        let _ = ai_win.eval(script);
    }
    Ok(())
}
