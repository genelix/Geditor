# Geditor 윈도우(Windows) 개발 및 운영 가이드

> **문서 버전**: v1.6.0  
> **대상 플랫폼**: Windows 10 (Build 1809 이상) / Windows 11 (64-bit)  
> **기술 스택**: Tauri v2.x (Rust) + React 18 + TypeScript + Monaco Editor + Microsoft Edge WebView2 + ConPTY  
> **배포 패키지**: 단독 실행 파일(`geditor.exe`) 및 NSIS 설치 프로그램(`Geditor_x64-setup.exe`)

---

## 1. 프로젝트 개요

**Geditor**는 초경량 고성능 네이티브 데스크톱 마크다운/코드 에디터입니다.  
유료 API 키를 발급받거나 서버를 구축하지 않고도, **사용자가 이미 로그인하여 사용 중인 브라우저(Microsoft Edge WebView2) 세션을 임베디드 DOM 자동화로 연동**하여 **인라인 AI 작성(`Alt+K`)**, **스마트 코드 삽입(`Alt+V`)**, **AI 도우미 사이드 패널**을 무제한 무료로 사용할 수 있습니다.

---

## 2. 윈도우 전용 주요 최적화 기능

1. **인라인 AI 작성 (`Alt+K`)**:
   - 에디터 본문에서 텍스트를 선택하거나 커서를 두고 `Alt+K`를 누르면 질문 입력창이 표시됩니다.
   - **원본 텍스트 100% 보존**: 기존 텍스트를 절대 삭제하지 않습니다.
   - **블록 끝 하단 자동 삽입**: 표, 리스트, 코드 블록, 인용구, 일반 문단의 마지막 줄 바로 아래에 AI 응답이 자동 입력됩니다.
2. **스마트 AI 코드 삽입 (`Alt+V`)**:
   - 웹 AI 화면에서 복사한 코드의 마크다운 펜스(```)를 자동 제거하고, 현재 에디터 커서의 들여쓰기 깊이에 맞추어 완벽하게 정렬하여 삽입합니다.
3. **네이티브 터미널 내장 (ConPTY PowerShell / CMD)**:
   - macOS의 `zsh` 대신 윈도우 표준 **PowerShell**(`powershell.exe`) 및 `cmd.exe`가 ConPTY 가상 터미널을 통해 실시간 연동됩니다.
4. **윈도우 전용 컨트롤 및 단축키**:
   - 윈도우 표준 타이틀바(최소화/최대화/닫기) 지원.
   - 단축키: `Ctrl+S`(저장), `Ctrl+N`(새 파일), `Ctrl+W`(탭 닫기), `Ctrl+B`(사이드바 토글), `Ctrl+\`(분할 뷰), `Ctrl+,`(환경설정), `Alt+K`(인라인 AI), `Alt+V`(스마트 삽입).
   - 기본 글꼴: `Consolas`, `Cascadia Code`, `맑은 고딕`, `D2Coding` 지원. 줄바꿈 `CRLF`/`LF` 자유 전환.

---

## 3. 윈도우 개발 환경 구축 (최초 1회 설정)

윈도우 PC에서 소스 코드를 빌드하고 디버깅하기 위해 아래 3가지 무료 도구가 필요합니다.

### 3.1 필수 도구 설치

1. **Node.js 설치**:
   - 다운로드: [https://nodejs.org](https://nodejs.org) (LTS 버전, v20 이상 권장)
   - 설치 확인: `node -v`, `npm -v`
2. **Rust 도구 설치**:
   - 다운로드: [https://rustup.rs](https://rustup.rs)
   - `rustup-init.exe` 실행 후 기본 옵션(1)으로 설치 (`x86_64-pc-windows-msvc` 툴체인 기본값)
   - 설치 확인: `rustc --version`, `cargo --version`
3. **Visual Studio C++ Build Tools**:
   - Rust가 윈도우 실행 파일(`.exe`)을 링크할 때 필수입니다.
   - [Visual Studio Build Tools 다운로드](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - 설치 시 워크로드 목록에서 **"C++를 사용한 데스크톱 개발 (Desktop development with C++)"** 항목을 반드시 체크하고 설치합니다.
4. **Microsoft Edge WebView2 런타임**:
   - Windows 10(최신 업데이트 버전) 및 Windows 11에는 이미 기본 탑재되어 있습니다.

### 3.2 패키지 설치
프로젝트 루트에서 원클릭 배치 파일을 실행합니다:
```cmd
install.bat
```
*(또는 명령 프롬프트에서 `npm install` 실행)*

---

## 4. 인라인 AI(`Alt+K`) 핵심 아키텍처 및 동작 원리

### 4.1 본문 선택 텍스트 보존 및 블록 끝 하단 자동 삽입

사용자가 본문에서 문단이나 표의 일부를 선택한 후 `Alt+K`로 추가 작성을 요청했을 때, **기존 내용이 사라지지 않고 블록 끝 바로 아래 줄에 생성 결과가 배치**되도록 지능형 블록 판정 엔진(`src/utils/editorBlockHelper.ts`)이 동작합니다.

```
+-------------------------------------------------------+
| Monaco Editor 본문 (사용자가 일부 텍스트 선택)         |
| 1: | 상품명 | 가격 |                                 |
| 2: | --- | --- |                                      |
| 3: | 노트북 | 150만원 | <-- (선택 위치)                 |
| 4: | 마우스 | 3만원 |   <-- [블록 끝 지점: 4번 줄]     |
+-------------------------------------------------------+
                           |
                           v  (Alt+K 실행)
+-------------------------------------------------------+
| 1: | 상품명 | 가격 |                                 |
| 2: | --- | --- |                                      |
| 3: | 노트북 | 150만원 | [원본 100% 보존]                |
| 4: | 마우스 | 3만원 |                                 |
| 5:                                                   |
| 6: [AI 출력 결과가 4번 줄 아래 빈 줄과 함께 자동 삽입] |
|    - 추천 사은품: 마우스패드, 파우치                 |
+-------------------------------------------------------+
```

#### 블록 판정 규칙 (`calculateBlockEndInsertion`)
1. **표(Table)**: 연속된 `|` 파이프 행이 끝나는 마지막 줄.
2. **코드 블록(Code Block)**: 닫는 코드 펜스(` ``` ` 또는 `~~~`) 행.
3. **리스트/일련번호(List/Ordered List)**: 해당 들여쓰기 깊이(`baseIndent`)의 리스트 및 하위 리스트 항목이 끝나는 마지막 줄.
4. **인용구(Blockquote)**: 연속된 `>` 인용 블록이 끝나는 마지막 줄.
5. **제목(Heading)**: 제목 행 (`# ~ ######`) 또는 setext 밑줄 행.
6. **일반 문단(Paragraph)**: 빈 줄(공백행) 또는 다른 마크다운 블록 요소가 시작되기 직전까지의 문단 마지막 줄.

### 4.2 임베디드 웹뷰 DOM 자동화 파이프라인

```
[에디터 (React)] 
      │ (1) 사용자 프롬프트 + 선택 텍스트 전달
      ▼
[Rust 코어 (ai_cmd.rs)] 
      │ (2) WebView2 eval("window.__geditor_start_inline_ai(...)")
      ▼
[WebView2 제미나이 웹 세션]
      ├─ (3) closeDrawersAndBackdrops(): 회색 음영 스크림/서랍 강제 해제
      ├─ (4) injectPromptText(): Quill Delta setText() 모델 직접 동기화
      ├─ (5) findSendButton(): 입력 컨테이너 우선 탐색 ("새 프롬프트" 오탐 배제)
      ├─ (6) submitPromptOnce(): 버튼 클릭 + Enter 키보드 이벤트 동시 방출
      └─ (7) submitDispatched = true (단 1회 확정 제출로 중복 세션 원천 차단)
      │
      ▼ (8) 토큰 스트리밍 모니터링 (300ms 폴링, quietDuration >= 1200ms)
[Rust 코어] 
      │ (9) 최종 순수 마크다운 추출 및 에디터로 반환
      ▼
[에디터 (React)] 
      └─ (10) calculateBlockEndInsertion() 위치에 executeEdits() 순수 삽입
```

---

## 5. ⚠️ 윈도우 환경 개발 시 반드시 주의해야 할 7대 핵심 함정

회사나 윈도우 환경에서 코드를 이식하거나 기능을 확장할 때, 아래 7가지 사항을 반드시 준수해야 초기 오류와 타임아웃을 방지할 수 있습니다.

### [함정 1] 전송 버튼 연타로 인한 "12회 중복 세션 생성 및 타임아웃"
- **문제 현상**: 전송 요청 직후 제미나이에 동일 제목 채팅방이 10~12개씩 생성되고, 정작 답변은 오지 않고 타임아웃 오류가 발생함.
- **원인**: 전송 버튼을 누른 후 스톱 버튼이나 응답 토큰이 화면에 나타나기까지 0.5~1.5초가 걸립니다. 폴링 루프에서 응답이 아직 없다는 이유로 전송 버튼과 Enter 키를 계속 연타하면, 제미나이 라우터가 신규 세션을 12개 동시 생성하며 이전 연결을 취소(Abort)해 버립니다.
- **해결책**: 반드시 `submitDispatched = true` 플래그를 두어 **단 1회만 확정 제출**하고, 이후 폴링에서는 일절 버튼을 누르지 말고 스트리밍 수신 대기 상태로만 유지해야 합니다. 2초 이상 입력창이 비워지지 않을 때만 제한적으로 1회 재시도합니다.

### [함정 2] 모바일 반응형 레이아웃의 "회색 반투명 스크림(음영) 클릭 차단"
- **문제 현상**: AI 패널에 텍스트는 입력되어 있으나 패널 전체가 회색으로 어둡게 음영 처리되어 있고 제출되지 않음. 패널을 마우스로 클릭하면 밝아지면서 제출 가능해짐.
- **원인**: 창 폭이 좁은 사이드 패널(~450px) 환경에서 제미나이는 모바일 모드로 전환되어 좌측 서랍 메뉴와 배경에 반투명 스크림(`mat-drawer-backdrop`, `.scrim`, `cdk-overlay-backdrop`)을 띄웁니다. 이 오버레이가 `pointer-events: auto`로 화면을 덮고 있어 전송 버튼 클릭이 차단됩니다.
- **해결책**: 스크립트 실행 즉시 `closeDrawersAndBackdrops()`를 호출하여 스크림 요소를 클릭 및 은닉(`display: none`, `pointerEvents: none`)하고 열린 서랍을 닫아야 합니다.

### [함정 3] "새 프롬프트" 버튼 오선택 버그
- **문제 현상**: 전송 버튼을 눌렀는데 질문이 전송되지 않고 새 대화 화면으로 리셋되거나 무반응으로 대기함.
- **원인**: 제미나이 웹 상단/사이드바에 `aria-label="새 프롬프트"` 또는 `"New chat"` 버튼이 있습니다. 단순 `button[aria-label*="프롬프트"]` 선택자를 사용하면 전송 버튼 대신 "새 프롬프트" 버튼을 먼저 찾아 클릭하게 됩니다.
- **해결책**:
  1. 입력 필드의 부모 컨테이너(`input.closest('fieldset, form, .input-area, rich-textarea')`) 내부를 **최우선 1순위**로 검색합니다.
  2. 라벨에 `"새 프롬프트"`, `"New chat"`, `"새 대화"`, `"보관함"`이 포함된 버튼은 명시적으로 제외합니다.
  3. `"프롬프트 제출"`, `"보내기"`, `"전송"`, `"Send"`, `"Submit"` 키워드로만 매칭합니다.

### [함정 4] Angular Material 및 Quill 이벤트 바인딩 호환성
- **문제 현상**: DOM의 버튼에 `.click()`을 호출해도 Angular 프레임워크가 폼 제출을 인식하지 못함.
- **원인**: Angular 컴포넌트의 클릭 이벤트가 `<button>` 본체가 아닌 내부의 `<mat-icon>`, `<svg>` 또는 부모 컨테이너(`.send-button-container`)에 바인딩되어 있거나, 버튼의 `disabled` 속성이 Angular 뷰 모델에 의해 제어되는 경우 단순 클릭이 무시됩니다.
- **해결책**:
  - `sendBtn.disabled = false`, `removeAttribute('disabled')`를 강제 적용합니다.
  - 버튼 본체, 내부 아이콘 child, 부모 컨테이너에 연달아 포인터/마우스 클릭을 방출합니다.
  - **동시에 입력 필드 및 `rich-textarea`에 `Enter`(키코드 13, `shiftKey: false`, `composed: true`) 키보드 이벤트를 반드시 함께 방출**합니다.

### [함정 5] 본문 선택 텍스트 덮어쓰기(삭제) 사고 방지
- **문제 현상**: AI 생성이 완료되면 원래 에디터에 적혀 있던 중요한 제목이나 본문이 통째로 날아가고 AI 답변으로 대체됨.
- **원인**: `editor.executeEdits('inline-ai', [{ range: selectedRange, text: cleaned }])` 형태로 선택 영역 전체를 교체 범위로 지정했기 때문입니다.
- **해결책**:
  - `calculateBlockEndInsertion` 함수로 해당 블록이 끝나는 행 번호(`blockEndLine`)와 마지막 열(`maxCol`)을 구합니다.
  - `range: new monaco.Range(blockEndLine, maxCol, blockEndLine, maxCol)`와 같이 **시작과 끝이 동일한 0길이 범위**로 지정하여 원본 텍스트를 절대 삭제하지 않고 순수 삽입합니다.

### [함정 6] 윈도우 WebView2 쿠키 및 세션 디렉터리 (`EBWebView`)
- **원인**: WebView2는 실행 파일 위치나 기본 임시 폴더에 사용자 데이터 폴더(`EBWebView`)를 생성하여 로그인 세션과 캐시를 유지합니다.
- **주의사항**:
  - 프로그램을 `C:\Program Files\` 등 관리자 권한이 필요한 읽기 전용 폴더에 설치할 경우, WebView2 데이터 디렉터리 쓰기 권한이 없어 웹뷰가 백지(White screen)로 멈출 수 있습니다.
  - Tauri는 `%APPDATA%\com.geditor.dev\` 또는 `%LOCALAPPDATA%`에 WebView2 데이터를 안전하게 분리 저장하므로, 절대 데이터 디렉터리를 프로그램 실행 파일 동일 디렉터리로 강제 지정하지 마십시오.

### [함정 7] ConPTY 가상 터미널 버전 요구사항
- **원인**: `portable-pty` 크레이트를 이용한 윈도우 가상 터미널(ConPTY) 기능은 Windows 10 Build 1809(10.0.17763) 이상에서만 지원됩니다.
- **주의사항**: 그 이전 구버전 윈도우 7/8이나 Windows 10 초기 빌드에서는 ConPTY 생성이 실패하므로, 대상 PC가 Windows 10 최신 업데이트 또는 Windows 11인지 확인해야 합니다.

---

## 6. 윈도우 개발 및 빌드 실행 방법

### 6.1 개발 및 디버그 모드 실행
```cmd
dev.bat
```
- 프론트엔드 Vite 로컬 서버(`http://localhost:1420`)와 Rust 코어가 컴파일되어 개발용 윈도우 창이 뜹니다.
- **F12 개발자 도구**: `src-tauri/tauri.conf.json`의 `"devtools": true` 설정으로 인해 창에서 `F12`를 누르면 WebView2 개발자 도구(Edge DevTools)가 열려 콘솔 로그와 DOM 상태를 실시간 점검할 수 있습니다.

### 6.2 배포용 실행 파일(`.exe`) 패키징
```cmd
build.bat
```
빌드가 완료되면 아래 위치에 설치 파일과 실행 파일이 생성됩니다:
- **단독 실행 파일 (포터블)**:
  `src-tauri\target\release\geditor.exe`
- **윈도우 공식 설치 프로그램 (NSIS Installer)**:
  `src-tauri\target\release\bundle\nsis\Geditor_0.1.0_x64-setup.exe`

---

## 7. 주요 파일 및 디렉터리 맵

| 경로 | 역할 및 설명 |
| :--- | :--- |
| `install.bat` | 윈도우 1클릭 npm 패키지 설치 스크립트 |
| `dev.bat` | 윈도우 개발 모드 실행 스크립트 (`npm run tauri dev`) |
| `build.bat` | 윈도우 릴리즈 패키징 빌드 스크립트 (`npm run tauri build`) |
| `README-WINDOWS.md` | 윈도우 개발 및 운영 종합 가이드 (본 문서) |
| `src/utils/editorBlockHelper.ts` | **핵심**: 본문 보존 및 표/코드/리스트/인용구/문단 블록 끝 하단 자동 삽입 엔진 |
| `src/utils/aiCodeParser.ts` | AI 응답 마크다운 정제(`cleanInlineAiOutput`), 들여쓰기 자동 정렬(`adjustIndentation`) |
| `src/components/EditorPane.tsx` | Monaco 에디터 인라인 AI(`Alt+K`), 스마트 삽입(`Alt+V`) UI 및 이벤트 제어 |
| `src/components/TerminalPane.tsx` | 윈도우 ConPTY PowerShell 연동 가상 터미널 UI |
| `src/services/tauriApi.ts` | Rust 백엔드와 프론트엔드 간 비동기 IPC 통신 래퍼 |
| `src-tauri/src/ai_cmd.rs` | **핵심**: WebView2 DOM 제어, 단일 확정 제출(`submitPromptOnce`), 스크림 해제 |
| `src-tauri/src/pty_cmd.rs` | 윈도우 `powershell.exe` 프로세스 생성 및 PTY 스트림 송수신 |
| `src-tauri/src/fs_cmd.rs` | 윈도우 대용량 파일 초고속 읽기/쓰기 및 UTF-8/EUC-KR 인코딩 자동 감지 |
| `src-tauri/tauri.conf.json` | 윈도우 창 크기, 메뉴, 웹뷰 보안 권한, NSIS 인스톨러 설정 |

---

## 8. 윈도우 배포 및 자가 검증 체크리스트

윈도우 PC에서 작업 완료 후 아래 체크리스트를 순서대로 확인하십시오:

- [ ] `install.bat` 실행 시 에러 없이 `node_modules` 생성이 완료되는가?
- [ ] `dev.bat` 실행 시 에러 없이 에디터 메인 창이 뜨는가?
- [ ] 하단 터미널을 열었을 때 `Windows PowerShell` 프롬프트가 정상 출력되고 명령어(`dir`, `cd` 등)가 입력되는가?
- [ ] 본문에서 제목이나 텍스트를 드래그한 상태로 `Alt+K`를 눌렀을 때 입력창이 뜨고, 질문 제출 시 제미나이에 **오직 1개의 채팅만 생성**되는가?
- [ ] AI 작성이 완료되었을 때, **선택했던 원본 텍스트가 사라지지 않고 블록 바로 아래 줄에 빈 줄과 함께 답변이 삽입**되는가?
- [ ] 표(`|`), 리스트(`-`), 코드 블록(```) 내에서 실행했을 때 각 포맷의 끝 지점을 정확히 찾아 하단에 삽입되는가?
- [ ] `build.bat` 실행 시 에러 없이 `src-tauri\target\release\geditor.exe`가 생성되고 정상 실행되는가?
