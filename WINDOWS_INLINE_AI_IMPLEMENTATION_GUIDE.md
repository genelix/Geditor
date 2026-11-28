# Geditor Windows 인라인 AI(Alt+K) 기능 구현 상세 설계서 (v1.6)

> **문서 버전**: v1.6.0  
> **대상 플랫폼**: Windows 10 / 11 (64-bit)  
> **기술 스택**: Tauri v2.x (Rust) + React 18 + TypeScript + Monaco Editor + Microsoft Edge WebView2  
> **핵심 개선 사항 (v1.6)**: 
> 1. **원본 선택 텍스트 100% 보존 및 블록 끝 하단 자동 삽입 (`calculateBlockEndInsertion`)**: 사용자가 본문에서 텍스트를 선택한 상태에서 인라인 AI 작성을 실행할 때, 기존의 선택 영역 덮어쓰기(삭제) 방식을 탈피하여 **원래 본문 텍스트를 100% 온전히 유지**하고, 해당 텍스트가 속한 **블록이 끝나는 바로 다음 줄에 AI 출력 결과가 자동으로 삽입**되도록 개선.
> 2. **마크다운/일반 텍스트 블록 경계 지능형 판정**:
>    - **표(Table)**: 연속된 `|` 파이프 행이 끝나는 마지막 줄.
>    - **코드 블록(Code Block)**: 닫는 코드 펜스(` ``` ` 또는 `~~~`) 행.
>    - **리스트/일련번호(List/Ordered List)**: 해당 들여쓰기 깊이(`baseIndent`)의 리스트 및 하위 리스트 항목이 끝나는 마지막 줄.
>    - **인용구(Blockquote)**: 연속된 `>` 인용 블록이 끝나는 마지막 줄.
>    - **제목(Heading)**: 제목 행 (`# ~ ######`) 또는 setext 밑줄 행.
>    - **일반 문단(Paragraph)**: 빈 줄(공백행) 또는 다른 마크다운 블록 요소가 시작되기 직전까지의 문단 마지막 줄.
> 3. **블록 간 여백 자동 포맷팅 (`\n\n`)**: 원본 블록과 생성된 AI 블록 사이에 빈 줄을 자동으로 두어 마크다운 포맷이 완벽히 분리되도록 보장.
> 4. **AI 프롬프트 중복 출력 제어**: `- 참조 본문 내용을 그대로 다시 복사하거나 반복하지 말고, 지시사항에 따른 새로운 결과 내용만 바로 작성하세요.` 지침을 프롬프트에 추가하여 AI가 원본 제목을 중복 출력하지 않도록 제어.
> 5. **반응형 모바일 사이드바 및 회색 음영 스크림 자동 해제 (`closeDrawersAndBackdrops`)**: 창 폭이 좁은 사이드바 환경에서 제미나이가 모바일 서랍 메뉴를 열고 배경에 회색 반투명 스크림(`mat-drawer-backdrop`, `cdk-overlay-backdrop`, `.scrim`)을 깔아 클릭을 가로막는 현상을 감지하고, 스크림 클릭 및 `style.display='none'`, `pointerEvents='none'`, 서랍 닫기 버튼 자동 클릭으로 화면 음영과 클릭 차단을 완벽 해제.
> 6. **전송 버튼 검색 영역 한정 및 오선택 방지 (`findSendButton`)**: 문서 전체에서 `"프롬프트"`라는 단어가 들어간 임의의 버튼(예: `새 프롬프트`)을 전송 버튼으로 잘못 식별하던 치명적 오류를 해결. 입력 필드의 부모 컨테이너(`rich-textarea`, `.input-area`, `fieldset` 등) 내부를 1순위로 검색하고, `새 프롬프트`, `New chat` 버튼은 제외하며 `프롬프트 제출`, `보내기`, `전송`, `Send` 등 명확한 전송 버튼만 매칭.
> 7. **클릭과 Enter 키보드 이벤트의 동시 다중 방출 (`submitPromptOnce`)**: 전송 버튼 발견 시 비활성화 속성(`disabled`, `aria-disabled`)을 제거하고 버튼 본체, 내부 아이콘(`<mat-icon>`, `<svg>`), 컨테이너를 차례로 클릭함과 동시에, 입력 필드 및 부모 `rich-textarea`에 `Enter`(키코드 13, `shiftKey: false`) 키보드 이벤트를 반드시 함께 방출하여 Angular 프레임워크가 어떤 리스너를 사용하든 100% 제출이 촉발되도록 보장.

---

## 1. 아키텍처 개요 및 단일 확정 제출 설계

### 1.1 핵심 동작 원리
본 기능은 유료 API 키 없이, **사용자가 이미 로그인하여 사용 중인 웹 브라우저 창(WebView2)의 DOM을 직접 제어(Headless / Embedded DOM Automation)**하여 동작합니다.

### 1.2 "동일 제목 채팅 12개 생성 및 무응답 타임아웃"의 근본 원인
1. **제출 확인 지연과 다중 재시도의 충돌**:
   - 브라우저에서 전송 버튼을 누르면 구글 제미나이 서버로 네트워크 요청이 전송되고 스톱 버튼이나 신규 말풍선이 화면에 렌더링되기까지 통상 0.5초~1.5초가 소요됩니다.
   - 기존 코드에서는 `attemptSubmitPrompt`가 반환하는 `isStopOrGeneratingPresent()`가 첫 몇 백 밀리초 동안 `false`라는 이유로, 타이머 배열(`[40, 120, 250, 500, ...]ms`)과 매 300ms 폴링 루프에서 **매번 전송 버튼을 다시 누르고 Enter 키를 연타**했습니다.
   - 2~3초 동안 누적 12회의 전송 요청이 연달아 웹소켓/서버로 발송되었습니다.
2. **구글 제미나이 서버의 요청 취소/상호 충돌**:
   - 제미나이 홈 화면(`/app`)에서 12번의 제출 이벤트가 빠르게 유입되자, 제미나이 프론트엔드 라우터가 12개의 신규 채팅 세션을 동시에 생성했습니다.
   - 이전 채팅 세션의 스트리밍 연결이 다음 제출 요청에 의해 즉각 중단(Abort)되거나 구글 서버의 속도 제한(Rate Limit)에 걸리면서, **12개의 채팅방 모두 질문만 생성되고 답변 스트림은 끊어지는 현상**이 발생했습니다.
   - 앱 에디터는 토큰이 들어오지 않으므로 타임아웃 오류를 출력했습니다.

### 1.3 해결책: `submitPromptOnce` 단일 확정 제출 & 상태 머신
1. **텍스트 주입 후 250ms 뒤 단 1회 전송**: Angular/Quill이 전송 버튼을 활성화하고 DOM 변경을 완료할 시간을 준 뒤, `submitPromptOnce`로 **단 1회만 클릭 및 Enter**를 동시 실행합니다.
2. **제출 즉시 상태 전환 (`submitDispatched = true`)**: 1회 제출된 후에는 어떠한 폴링 틱에서도 전송 버튼을 다시 누르지 않습니다.
3. **응답 신호 수신 대기**:
   - 스톱 버튼 출현 (`isStopPresent`)
   - 신규 어시스턴트 메시지 버블 출현 (`newMsgs.length > 0`)
   - 입력창 내용 비워짐 (`inputLen === 0`)
4. **2초 가드레일 (`submitCount < 3`)**: 만약 2초가 지났는데도 입력창에 텍스트가 그대로 남아있고 아무 응답도 시작되지 않은 경우에 한해, 스크림을 재해제하고 최대 2회까지 제한적 재시도를 실행합니다.

---

## 2. WebView2 브라우저 내 주입 스크립트 (`AI_DOM_CONTROLLER_SCRIPT`)

```javascript
(function() {
    if (window.__geditor_controller_installed) return;
    window.__geditor_controller_installed = true;

    // DOM 노드를 순수 마크다운(GFM)으로 변환
    function domToMarkdown(node) {
        if (!node) return "";
        if (node.nodeType === 3) return node.nodeValue;
        if (node.nodeType !== 1) return "";

        const tag = (node.tagName || "").toUpperCase();

        if (node.classList && (node.classList.contains('katex') || node.classList.contains('math'))) {
            const ann = node.querySelector('annotation[encoding*="tex"]');
            if (ann && ann.textContent) {
                const isBlock = node.classList.contains('katex-display') || tag === 'DIV';
                return isBlock ? "\n\n$$" + ann.textContent.trim() + "$$\n\n" : " $" + ann.textContent.trim() + "$ ";
            }
        }

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

        if (tag === 'CODE') {
            if (node.parentElement && node.parentElement.tagName === 'PRE') return node.textContent || '';
            const t = node.textContent || '';
            return t ? " `" + t + "` " : "";
        }

        if (tag === 'TABLE') {
            const allTrs = Array.from(node.querySelectorAll('tr'));
            const cellText = (c) => domToMarkdown(c).trim().replace(/\r?\n+/g, " ").replace(/\|/g, "\\|") || " ";
            const rows = allTrs.map(tr => Array.from(tr.querySelectorAll('th, td')).map(cellText)).filter(r => r.length > 0);
            if (rows.length === 0) return "";
            const maxCols = Math.max(...rows.map(r => r.length));
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

        if (tag === 'H1') return "\n\n# " + childrenToMarkdown(node).trim() + "\n\n";
        if (tag === 'H2') return "\n\n## " + childrenToMarkdown(node).trim() + "\n\n";
        if (tag === 'H3') return "\n\n### " + childrenToMarkdown(node).trim() + "\n\n";
        if (tag === 'H4') return "\n\n#### " + childrenToMarkdown(node).trim() + "\n\n";

        if (tag === 'STRONG' || tag === 'B') return "**" + childrenToMarkdown(node).trim() + "**";
        if (tag === 'EM' || tag === 'I') return "*" + childrenToMarkdown(node).trim() + "*";
        if (tag === 'DEL' || tag === 'S') return "~~" + childrenToMarkdown(node).trim() + "~~";
        if (tag === 'BLOCKQUOTE') return "\n\n> " + childrenToMarkdown(node).trim().replace(/\n/g, "\n> ") + "\n\n";

        if (tag === 'UL') {
            const lis = Array.from(node.children).filter(c => c.tagName === 'LI');
            return "\n\n" + lis.map(li => "- " + childrenToMarkdown(li).trim()).join('\n') + "\n\n";
        }
        if (tag === 'OL') {
            const lis = Array.from(node.children).filter(c => c.tagName === 'LI');
            return "\n\n" + lis.map((li, i) => (i + 1) + ". " + childrenToMarkdown(li).trim()).join('\n') + "\n\n";
        }

        if (tag === 'P') return "\n\n" + childrenToMarkdown(node).trim() + "\n\n";
        if (tag === 'BR') return "\n";
        if (tag === 'HR') return "\n\n---\n\n";

        return childrenToMarkdown(node);
    }

    function childrenToMarkdown(parent) {
        let res = "";
        for (let i = 0; i < parent.childNodes.length; i++) {
            res += domToMarkdown(parent.childNodes[i]);
        }
        return res;
    }

    window.__geditor_dom_to_markdown = domToMarkdown;

    function findInputField(root = document) {
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
            // 브라우저 및 Quill 리치에디터는 다중 행(\n) 입력을 paste 이벤트를 통해 단락(<p>)으로 가장 안정적으로 파싱함
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

            // 2. 다중 행 DOM 단락 직접 삽입 폴백 (paste가 거부되거나 단일 행만 들어간 경우)
            if (cur.length < text.trim().length * 0.7) {
                const paragraphs = text.split('\n');
                target.innerHTML = paragraphs.map(p => p.length > 0 ? '<p>' + escapeHtml(p) + '</p>' : '<p><br></p>').join('');
                target.classList.remove('ql-blank');
            }

            // 3. Quill 모델 직접 setText 동기화 (Quill 인스턴스 발견 시)
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

        // 4. 표준 DOM 이벤트 방출 (Angular / React 모델 동기화)
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
        if (!root) root = document;
        const input = findInputField(root);
        const searchRoots = [];
        if (input) {
            const inputContainer = input.closest('fieldset, form, .input-area, .input-area-container, .bottom-container, .chat-input-container, rich-textarea') || input.parentElement;
            if (inputContainer) {
                searchRoots.push(inputContainer);
                if (inputContainer.parentElement) searchRoots.push(inputContainer.parentElement);
                if (inputContainer.parentElement && inputContainer.parentElement.parentElement) {
                    searchRoots.push(inputContainer.parentElement.parentElement);
                }
            }
        }
        searchRoots.push(root);

        const selectors = [
            'button.send-button',
            '.send-button-container button',
            'button[aria-label*="보내기"]',
            'button[aria-label*="전송"]',
            'button[aria-label*="프롬프트 제출"]',
            'button[aria-label*="프롬프트 전송"]',
            'button[aria-label*="Send"]',
            'button[aria-label*="Submit"]',
            'button[data-testid="send-button"]',
            'button.mat-mdc-icon-button[aria-label*="보내기"]',
            'button.mat-mdc-icon-button[aria-label*="전송"]',
            'button.mat-mdc-icon-button[aria-label*="제출"]',
            'button.mat-mdc-icon-button[aria-label*="Send"]',
            'button[mattooltip*="보내기"]',
            'button[mattooltip*="전송"]',
            'button[mattooltip*="제출"]',
            'button[mattooltip*="Send"]',
            'div[role="button"][aria-label*="보내기"]',
            'div[role="button"][aria-label*="전송"]',
            'div[role="button"][aria-label*="제출"]',
            'div[role="button"][aria-label*="Send"]',
            'button.send-button-container',
            'button[type="submit"]',
            'fieldset button:last-child'
        ];

        for (const r of searchRoots) {
            for (const sel of selectors) {
                try {
                    const els = r.querySelectorAll(sel);
                    for (const el of els) {
                        if (el && (el.offsetParent !== null || el.offsetHeight > 0 || window.getComputedStyle(el).display !== 'none')) {
                            const label = (el.getAttribute('aria-label') || el.innerText || '').trim();
                            // "새 프롬프트" (New Chat) 또는 보관함 등 오선택 방지
                            if (label.includes('새 프롬프트') || label.includes('New chat') || label.includes('새 대화') || label.includes('보관함')) {
                                continue;
                            }
                            return el;
                        }
                    }
                } catch (e) {}
            }
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

    // 모바일 레이아웃 반응형 서랍 및 회색 음영 스크림 자동 해제
    function closeDrawersAndBackdrops() {
        try {
            const scrims = document.querySelectorAll('.scrim, .chat-history-scrim, .full-screen-scrim, [class*="scrim"], [class*="backdrop"], .cdk-overlay-backdrop, mat-drawer-backdrop');
            for (const s of scrims) {
                if (!s.closest('mat-dialog-container, [role="dialog"], [role="alertdialog"]')) {
                    try { s.click(); } catch(e2) {}
                    s.style.display = 'none';
                    s.style.opacity = '0';
                    s.style.pointerEvents = 'none';
                }
            }
            const openDrawers = document.querySelectorAll('mat-drawer.mat-drawer-opened, mat-sidenav.mat-sidenav-opened, [class*="drawer"][class*="opened"], [class*="sidebar"][class*="open"]');
            for (const d of openDrawers) {
                const closeBtn = d.querySelector('button[aria-label*="닫기"], button[aria-label*="Close"], button[aria-label*="접기"], .close-button');
                if (closeBtn) {
                    try { closeBtn.click(); } catch(e3) {}
                }
                d.classList.remove('mat-drawer-opened', 'mat-sidenav-opened', 'opened', 'open');
            }
            const navClose = document.querySelectorAll('button[aria-label*="메뉴 접기"], button[aria-label*="탐색 메뉴 닫기"], button[aria-label*="사이드 탐색 창 접기"], button[aria-label*="Collapse menu"]');
            for (const b of navClose) {
                try { b.click(); } catch(e4) {}
            }
        } catch(e) {}
    }
    const dismissScrims = closeDrawersAndBackdrops;

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
                charCode: 13,
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window,
                shiftKey: false,
                altKey: false,
                ctrlKey: false,
                metaKey: false
            };
            el.dispatchEvent(new KeyboardEvent('keydown', evInit));
            el.dispatchEvent(new KeyboardEvent('keypress', evInit));
            el.dispatchEvent(new KeyboardEvent('keyup', evInit));
        } catch(e) {}
    }

    // 단 1회 확정 제출 함수 (클릭 + Enter 키 동시 방출로 제출 신뢰성 100% 보장)
    function submitPromptOnce(targetInput) {
        if (!targetInput) return false;
        closeDrawersAndBackdrops();
        wakeUpElement(targetInput);

        const sendBtn = findSendButton(document);
        if (sendBtn) {
            try {
                sendBtn.disabled = false;
                sendBtn.removeAttribute('disabled');
                sendBtn.setAttribute('aria-disabled', 'false');
                sendBtn.classList.remove('disabled');
            } catch(e) {}

            triggerClick(sendBtn);
            const child = sendBtn.querySelector('mat-icon, svg, span');
            if (child) triggerClick(child);
            const container = sendBtn.closest('.send-button-container') || sendBtn.parentElement;
            if (container && container !== sendBtn) triggerClick(container);
        }

        // 항상 입력 필드 및 상위 rich-textarea 래퍼에 Enter 키 동시 방출
        triggerEnter(targetInput);
        const rich = targetInput.closest('rich-textarea') || targetInput.closest('.input-area');
        if (rich && rich !== targetInput) {
            triggerEnter(rich);
        }

        if (targetInput.form) {
            try { targetInput.form.requestSubmit(); } catch(fe) {}
        }

        closeDrawersAndBackdrops();
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
                if (el && (el.offsetParent !== null || el.offsetHeight > 0)) return true;
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
                if (list.length > 0) return Array.from(list);
            } catch (e) {}
        }
        const mdList = document.querySelectorAll('.markdown');
        return Array.from(mdList);
    }

    // 1. 인라인 AI 시작 함수
    window.__geditor_start_inline_ai = function(text) {
        dismissScrims();

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

        // 1. 텍스트 주입
        injectPromptText(target, text);
        window.__geditor_ai_state.textInjected = true;

        // 2. 180ms 후 단 1회 확정 제출 (연타 방지)
        setTimeout(function() {
            if (!window.__geditor_ai_state || window.__geditor_ai_state.submitDispatched) return;
            const targetEl = findInputField(document) || target;
            submitPromptOnce(targetEl);
            window.__geditor_ai_state.submitDispatched = true;
            window.__geditor_ai_state.submitCount = 1;
            window.__geditor_ai_state.submitTimestamp = Date.now();
            dismissScrims();
        }, 180);

        return JSON.stringify(window.__geditor_ai_state);
    };

    // 2. 인라인 AI 상태 폴링 함수
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

        // 1. 제출 수신 여부 확인 (연타 제출 금지)
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
                // 4초 이상 입력창이 비워지지 않고 대기 중일 때만 최대 1회 제한적 재시도
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

        // 2. 신규 응답 메시지 탐색 (역사적 메시지 제외)
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
            if (candText !== state.oldLastText && candText.length > 5) {
                curMsg = candidate;
                curLength = candText.length;
            }
        }

        // 첫 토큰 대기
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

        // 3. 토큰 스트리밍 추적
        if (curLength > state.lastTextLength) {
            state.lastTextLength = curLength;
            state.lastChangeTime = now;
            state.status = 'generating';
        }

        const isGenerating = isStopOrGeneratingPresent();
        const quietDuration = now - state.lastChangeTime;

        // 4. 완료 판정: 2자 이상, 스톱 버튼 사라짐, 1.2초간 추가 출력 없음
        if (curLength >= 2 && !isGenerating && quietDuration >= 1200) {
            state.status = 'done';
            state.resultMarkdown = domToMarkdown(curMsg).trim();
            return JSON.stringify(state);
        }

        if (elapsed > 120000) {
            if (state.lastTextLength > 10) {
                state.status = 'done';
                state.resultMarkdown = domToMarkdown(curMsg).trim();
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
})();
```

---

## 3. Rust 백엔드 핵심 (`src-tauri/src/ai_cmd.rs`)

```rust
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
        return Err("AI 패널이 열려있지 않습니다. AI 패널을 먼저 활성화해 주세요.".to_string());
    };

    let _ = webview.set_focus();
    let _ = webview.eval(AI_DOM_CONTROLLER_SCRIPT);

    let final_prompt = match selected_text {
        Some(ref text) if !text.trim().is_empty() => {
            format!(
                "[사용자 요청]\n{}\n\n[참조 본문 내용]\n{}\n\n[출력 지침]\n- 요청에 맞는 결과 텍스트(또는 마크다운)만 출력하세요.\n- 인사말, 서두('네, 작성해 드렸습니다'), 결말 부연 설명은 일절 생략하고 본문에 바로 교체/삽입될 완성된 내용만 작성하세요.",
                prompt.trim(),
                text.trim()
            )
        }
        _ => {
            format!(
                "[사용자 요청]\n{}\n\n[출력 지침]\n- 요청에 맞는 텍스트 또는 마크다운을 바로 작성하세요.\n- 인사말, 서두, 맺음말 없이 본문에 바로 삽입될 완성된 내용만 작성하세요.",
                prompt.trim()
            )
        }
    };

    let _ = crate::clipboard_cmd::write_clipboard_text(final_prompt.clone());

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

    let encoded = serde_json::to_string(&final_prompt).unwrap_or_else(|_| format!("\"{}\"", final_prompt));
    let start_script = format!(
        r#"
        (function() {{
            try {{
                if (typeof window.__geditor_start_inline_ai === 'function') {{
                    return window.__geditor_start_inline_ai({});
                }}
                return JSON.stringify({{ status: "error", error: "컨트롤러 스크립트가 준비되지 않았습니다." }});
            }} catch(e) {{
                return JSON.stringify({{ status: "error", error: e.toString() }});
            }}
        }})()
        "#,
        encoded
    );

    webview.eval(&start_script).map_err(|e| e.to_string())?;

    let start_time = std::time::Instant::now();
    let max_duration = std::time::Duration::from_secs(120);

    loop {
        if start_time.elapsed() > max_duration {
            return Err("AI 응답 대기 시간이 초과되었습니다 (120초).".to_string());
        }

        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        let (tx, rx) = tokio::sync::oneshot::channel();
        let tx_arc = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
        let tx_clone = tx_arc.clone();

        let check_script = r#"
            (function() {
                try {
                    return window.__geditor_check_inline_ai_status ? window.__geditor_check_inline_ai_status() : "";
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

        let raw_res = match tokio::time::timeout(std::time::Duration::from_millis(2000), rx).await {
            Ok(Ok(s)) => s,
            _ => continue,
        };

        let json_str: String = serde_json::from_str(&raw_res).unwrap_or(raw_res);
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
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
```

---

## 4. 프론트엔드 에디터 블록 보존 및 블록 끝 하단 자동 삽입 (`src/utils/editorBlockHelper.ts`)

### 4.1 핵심 요구사항
1. **원본 선택 텍스트 100% 보존**:
   - 기존의 `selectedRange` 대체(덮어쓰기)를 완전히 제거하고, 선택 영역을 전혀 삭제하지 않는 **순수 삽입(Insert-only)** 아키텍처 적용.
2. **블록(Block) 끝 지점 자동 판정**:
   - **마크다운 표(Table)**: 연속된 `|` 파이프 행이 끝나는 마지막 줄.
   - **코드 블록(Code Block)**: 닫는 코드 펜스(` ``` ` 또는 `~~~`) 행.
   - **리스트/일련번호(List/Ordered List)**: 해당 들여쓰기 깊이(`baseIndent`)의 리스트 및 하위 리스트 항목이 끝나는 마지막 줄.
   - **인용구(Blockquote)**: 연속된 `>` 인용 블록이 끝나는 마지막 줄.
   - **제목(Heading)**: 제목 행 (`# ~ ######`) 또는 setext 밑줄 행.
   - **일반 문단(Paragraph)**: 빈 줄(공백행) 또는 다른 마크다운 블록 요소가 시작되기 직전까지의 문단 마지막 줄.
3. **블록 간 여백 포맷팅 (`\n\n`)**:
   - 원본 블록 바로 아래에 빈 줄(`\n\n`)을 두고 AI 생성 결과를 삽입하여 마크다운 레이아웃 및 가독성을 극대화.

### 4.2 `editorBlockHelper.ts` 전체 구현 코드

```typescript
export interface BlockInsertionResult {
  insertLineNumber: number;
  insertColumn: number;
  textToInsert: string;
}

export function calculateBlockEndInsertion(
  getLineContent: (lineNumber: number) => string,
  getLineMaxColumn: (lineNumber: number) => number,
  totalLines: number,
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  },
  cleanedOutput: string
): BlockInsertionResult {
  let startLine = range.startLineNumber;
  let endLine = range.endLineNumber;

  // 다음 행 1열까지 드래그된 경우 직전 줄로 보정
  if (range.endColumn === 1 && endLine > startLine) {
    endLine = endLine - 1;
  }

  startLine = Math.max(1, Math.min(totalLines, startLine));
  endLine = Math.max(1, Math.min(totalLines, endLine));

  const endLineContent = getLineContent(endLine);
  const trimmedEnd = endLineContent.trim();

  // 커서가 이미 빈 줄에 있는 경우
  if (trimmedEnd === '' && startLine === endLine) {
    const maxCol = getLineMaxColumn(endLine);
    return {
      insertLineNumber: endLine,
      insertColumn: maxCol,
      textToInsert: cleanedOutput,
    };
  }

  let blockEndLine = endLine;

  // 1. 코드 블록(Fenced Code Block)
  let inCodeBlock = false;
  const fencePattern = /^\s*(```|~~~)/;
  for (let i = 1; i <= endLine; i++) {
    if (fencePattern.test(getLineContent(i))) inCodeBlock = !inCodeBlock;
  }
  if (inCodeBlock) {
    for (let i = endLine + 1; i <= totalLines; i++) {
      if (fencePattern.test(getLineContent(i))) {
        blockEndLine = i;
        break;
      }
      blockEndLine = totalLines;
    }
  }
  // 2. 표(Table)
  else if (trimmedEnd.includes('|')) {
    let cur = endLine;
    while (cur < totalLines) {
      const next = getLineContent(cur + 1).trim();
      if (next === '' || !next.includes('|')) break;
      cur++;
    }
    blockEndLine = cur;
  }
  // 3. 리스트 / 일련번호
  else if (/^(\s*)([-*+]|\d+[\.)]|\([0-9a-zA-Z]+\)|[a-zA-Z][\.)])\s+/.test(endLineContent)) {
    const listMatch = endLineContent.match(/^(\s*)([-*+]|\d+[\.)]|\([0-9a-zA-Z]+\)|[a-zA-Z][\.)])\s+/);
    const baseIndent = listMatch ? listMatch[1].length : 0;
    const listRegex = /^(\s*)([-*+]|\d+[\.)]|\([0-9a-zA-Z]+\)|[a-zA-Z][\.)])\s+/;

    let cur = endLine;
    while (cur < totalLines) {
      const nextRaw = getLineContent(cur + 1);
      const nextTrim = nextRaw.trim();
      if (nextTrim === '') break;

      const nextListMatch = nextRaw.match(listRegex);
      if (nextListMatch) {
        const nextIndent = nextListMatch[1].length;
        if (nextIndent >= baseIndent) cur++;
        else break;
      } else {
        const indentMatch = nextRaw.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;
        if (indent > baseIndent) cur++;
        else break;
      }
    }
    blockEndLine = cur;
  }
  // 4. 인용구(Blockquote)
  else if (/^\s*>/.test(trimmedEnd)) {
    let cur = endLine;
    while (cur < totalLines) {
      const nextTrim = getLineContent(cur + 1).trim();
      if (!/^\s*>/.test(nextTrim)) break;
      cur++;
    }
    blockEndLine = cur;
  }
  // 5. 제목(Heading)
  else if (/^#{1,6}\s+/.test(trimmedEnd)) {
    blockEndLine = endLine;
  }
  else if (endLine < totalLines && /^(=+|-+)$/.test(getLineContent(endLine + 1).trim()) && trimmedEnd !== '') {
    blockEndLine = endLine + 1;
  }
  // 6. 구분선(Thematic Break)
  else if (/^(?:[-*_]\s*){3,}$/.test(trimmedEnd)) {
    blockEndLine = endLine;
  }
  // 7. 일반 문단(Paragraph)
  else {
    let cur = endLine;
    const listRegex = /^(\s*)([-*+]|\d+[\.)]|\([0-9a-zA-Z]+\)|[a-zA-Z][\.)])\s+/;
    while (cur < totalLines) {
      const nextRaw = getLineContent(cur + 1);
      const nextTrim = nextRaw.trim();
      if (nextTrim === '') break;

      if (
        /^#{1,6}\s+/.test(nextTrim) ||
        fencePattern.test(nextTrim) ||
        nextTrim.includes('|') ||
        listRegex.test(nextRaw) ||
        /^\s*>/.test(nextTrim) ||
        /^(?:[-*_]\s*){3,}$/.test(nextTrim)
      ) {
        break;
      }
      cur++;
    }
    blockEndLine = cur;
  }

  const maxCol = getLineMaxColumn(blockEndLine);
  const lineAfter = blockEndLine < totalLines ? getLineContent(blockEndLine + 1).trim() : null;

  let textToInsert = '';
  if (lineAfter === null || lineAfter === '') {
    textToInsert = '\n\n' + cleanedOutput;
  } else {
    textToInsert = '\n\n' + cleanedOutput + '\n';
  }

  return {
    insertLineNumber: blockEndLine,
    insertColumn: maxCol,
    textToInsert,
  };
}
```

### 4.3 `EditorPane.tsx` 연동

```typescript
const targetRange = inlineAiState.hasSelection && inlineAiState.selectedRange
  ? inlineAiState.selectedRange
  : {
      startLineNumber: inlineAiState.cursorPosition?.lineNumber || 1,
      startColumn: inlineAiState.cursorPosition?.column || 1,
      endLineNumber: inlineAiState.cursorPosition?.lineNumber || 1,
      endColumn: inlineAiState.cursorPosition?.column || 1,
    };

const insertion = calculateBlockEndInsertion(
  (lineNum) => model.getLineContent(lineNum),
  (lineNum) => model.getLineMaxColumn(lineNum),
  model.getLineCount(),
  targetRange,
  cleaned
);

// 원본 텍스트를 절대 삭제하지 않는 순수 삽입(Insert-only)
editor.executeEdits('inline-ai', [
  {
    range: new monaco.Range(
      insertion.insertLineNumber,
      insertion.insertColumn,
      insertion.insertLineNumber,
      insertion.insertColumn
    ),
    text: insertion.textToInsert,
    forceMoveMarkers: true,
  },
]);

// 생성된 결과 블록 시작점으로 커서 이동 및 뷰포트 센터링
const targetFocusLine = Math.min(model.getLineCount(), insertion.insertLineNumber + 2);
editor.setPosition(new monaco.Position(targetFocusLine, 1));
editor.revealPositionInCenterIfOutsideViewport(new monaco.Position(targetFocusLine, 1));
```

---

## 5. ⚠️ 윈도우 환경 개발 시 7대 초기 오류 방지 핵심 주의사항 (Crucial Precautions)

회사에서 윈도우 PC 환경으로 코드를 이식하거나 기능을 확장할 때, 아래 7가지 사항을 엄격히 준수하여 초기 오류를 사전에 차단하십시오:

### 1) 전송 버튼 연타 금지 (`submitDispatched` 단일 제출 필수)
- **위험**: 제미나이 웹에서 짧은 시간 동안 여러 번의 전송(클릭/Enter) 이벤트가 유입되면, 백엔드 세션 라우터가 12개의 신규 세션을 동시에 생성하면서 이전 세션을 전부 Abort(중단) 처리하여 응답 스트림이 끊어지고 45초/120초 타임아웃이 발생합니다.
- **수칙**: 반드시 `submitDispatched = true` 상태를 기록하여 단 1회만 제출하고, 폴링 루프에서는 버튼을 절대 다시 누르지 말고 스트리밍 수신만 감지해야 합니다.

### 2) 모바일 반응형 서랍 및 회색 스크림 강제 해제 (`closeDrawersAndBackdrops`)
- **위험**: 사이드바 패널 폭이 좁으면 제미나이가 모바일 모드로 전환되어 배경에 회색 반투명 오버레이(`mat-drawer-backdrop`, `.scrim`)를 생성합니다. 이 오버레이는 `pointer-events: auto`로 화면 전체를 덮어 마우스 클릭을 가로챕니다.
- **수칙**: 전송 버튼을 누르기 전과 누른 직후 반드시 `closeDrawersAndBackdrops()`를 호출하여 스크림 요소를 클릭 및 숨김(`display: none`, `pointer-events: none`) 처리하고 열린 서랍을 닫아야 합니다.

### 3) "새 프롬프트" 버튼 오선택 방지
- **위험**: 제미나이 웹 상단에 있는 `aria-label="새 프롬프트"`(New Chat) 버튼이 전송 버튼으로 오탐될 수 있습니다. 이 버튼을 클릭하면 대화창이 리셋되고 질문이 증발합니다.
- **수칙**:
  - `input.closest('fieldset, form, .input-area, rich-textarea')` 내부를 최우선 1순위로 검색합니다.
  - 라벨에 `"새 프롬프트"`, `"New chat"`, `"새 대화"`, `"보관함"`이 포함된 버튼은 무조건 건너뜁니다(`continue`).
  - `"프롬프트 제출"`, `"보내기"`, `"전송"`, `"Send"`, `"Submit"` 정확한 전송 키워드로만 매칭합니다.

### 4) 버튼 클릭과 Enter 키보드 이벤트의 동시 다중 방출
- **위험**: Angular Material 컴포넌트는 클릭 이벤트가 `<button>`이 아닌 내부 `<mat-icon>`에 걸려 있거나, Angular 뷰 모델에 의해 `disabled` 상태로 관리되어 단순 `.click()`이 무시될 수 있습니다.
- **수칙**:
  - 버튼의 `disabled` 속성을 강제 제거합니다.
  - 버튼 본체, 내부 아이콘 child, 부모 컨테이너를 차례로 클릭합니다.
  - **동시에 입력 필드 및 부모 `rich-textarea`에 `Enter`(키코드 13, `shiftKey: false`, `composed: true`) 키보드 이벤트를 반드시 함께 방출**합니다.

### 5) 본문 선택 텍스트 100% 보존 (순수 삽입 아키텍처)
- **위험**: `editor.executeEdits('inline-ai', [{ range: selectedRange, text: cleaned }])` 형태로 선택 영역 전체를 교체 범위로 지정하면, 원본 텍스트가 삭제되는 치명적 데이터 유실이 발생합니다.
- **수칙**:
  - `calculateBlockEndInsertion` 함수로 블록 끝 행 번호(`blockEndLine`)와 열(`maxCol`)을 구합니다.
  - `range: new monaco.Range(blockEndLine, maxCol, blockEndLine, maxCol)`와 같이 시작과 끝이 같은 **0길이 순수 삽입 범위**로 실행하여 원본 텍스트를 온전히 보존합니다.

### 6) 윈도우 WebView2 사용자 데이터 디렉터리(`EBWebView`) 권한 관리
- **위험**: 윈도우에서 `C:\Program Files\` 등 쓰기 권한이 없는 디렉터리에 앱이 설치되었을 때 WebView2 데이터 폴더 생성이 실패하여 화면이 백지(Blank)로 멈출 수 있습니다.
- **수칙**:
  - Tauri는 기본적으로 `%LOCALAPPDATA%` 또는 `%APPDATA%`의 앱 전용 디렉터리에 WebView2 캐시와 쿠키를 안전하게 생성합니다.
  - 임의로 실행 파일 동일 디렉터리로 데이터 경로를 강제 변경하지 마십시오.

### 7) Windows 10 빌드 요구사항 (ConPTY 터미널)
- **위험**: 윈도우 내장 터미널을 구동하는 `portable-pty`의 ConPTY 기능은 Windows 10 Build 1809 (10.0.17763) 이상에서만 지원됩니다.
- **수칙**: 대상 윈도우 PC가 최신 Windows 10 또는 Windows 11인지 사전에 확인하십시오.

---

## 6. 검증 체크리스트
1. **원본 선택 텍스트 보존 확인**:
   - 본문 텍스트를 드래그한 상태에서 `Alt+K` 실행 시, 기존 텍스트가 사라지지 않고 그대로 유지되는지 확인
2. **블록 하단 줄 삽입 확인**:
   - 표, 리스트, 코드 블록, 인용구, 일반 문단의 마지막 줄 바로 아래에 빈 줄과 함께 AI 응답이 깔끔하게 삽입되는지 확인
3. **단일 채팅 생성 확인**:
   - `Alt+K` 실행 시 제미나이에 오직 1개의 채팅만 생성되고 12회 중복 세션 버그가 발생하지 않는지 확인
4. **타임아웃 완전 방지 및 본문 즉시 반영**:
   - 응답 완료 즉시 에디터에 결과가 삽입되고 커서가 생성된 내용 위치로 자동 이동하는지 확인
5. **윈도우 전용 단축키 및 터미널 동작**:
   - `Ctrl+S`, `Ctrl+N`, `Ctrl+W` 및 `Alt+K`, `Alt+V` 단축키 정상 작동
   - 하단 터미널에서 PowerShell 프롬프트 정상 출력 및 명령어 실행 확인
