# Geditor 윈도우(Windows) 실행 및 빌드 안내 가이드

이 폴더(`geditor-windows`)는 **Windows 10/11 환경**에서 완벽하게 동작하도록 최적화된 **Geditor**의 전체 소스 코드입니다.  
나중에 이 폴더를 윈도우 PC로 복사하여 바로 실행하거나 단독 실행 파일(`.exe`)로 패키징할 수 있습니다.

---

## 🌟 윈도우 전용 최적화 내역

1. **내장 터미널 자동 전환 (PowerShell / CMD)**
   - macOS의 `zsh` 대신 윈도우 네이티브 **PowerShell**(`powershell.exe`) 또는 `cmd.exe`가 ConPTY를 통해 가상 터미널로 연동됩니다.
2. **윈도우 네이티브 창 컨트롤 (Decorations)**
   - 윈도우 표준 타이틀바(최소화, 최대화, 닫기 버튼)와 창 테두리가 자연스럽게 적용됩니다.
3. **윈도우 전용 단축키 및 폰트**
   - 단축키 안내가 `Cmd(⌘)` 대신 `Ctrl` 기반(`Ctrl+S`, `Ctrl+N`, `Ctrl+W`, `Ctrl+B`, `Ctrl+\`, `Ctrl+T`, `Ctrl+,`)으로 표시됩니다.
   - 에디터 기본 글꼴이 `Consolas`, `Cascadia Code`, `맑은 고딕`, `D2Coding` 등 윈도우 환경에 맞게 제공됩니다.
   - 기본 줄바꿈 문자가 윈도우 표준인 `CRLF`로 기본 설정됩니다. (환경설정에서 `LF`로 자유롭게 변경 가능)
4. **한글 메뉴바 및 환경설정 완벽 지원**
   - 상단 메뉴바: `파일`, `편집`, `보기`, `설정`, `도움말`
   - 환경설정 모달(`Ctrl+,`): 글꼴, 크기, 줄간격, 다크/라이트 테마, 자동 저장 등 지원

---

## 💻 윈도우 PC에서 필요한 사전 준비 (최초 1회만 설치)

윈도우 PC에서 소스 코드를 빌드하고 실행하려면 아래의 무료 개발 도구가 설치되어 있어야 합니다.

1. **Node.js 설치**
   - 공식 사이트: [https://nodejs.org](https://nodejs.org)
   - LTS 버전(v20 이상 권장) 다운로드 후 설치
2. **Rust 도구 설치**
   - 공식 사이트: [https://rustup.rs](https://rustup.rs)
   - `rustup-init.exe` 다운로드 후 실행하여 기본 옵션(1)으로 설치
3. **C++ 빌드 도구 (Visual Studio C++ Build Tools)**
   - Rust 컴파일러가 윈도우 실행 파일을 만들 때 필요합니다.
   - `rustup-init.exe` 실행 시 자동으로 설치 링크가 안내되며, 또는 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)에서 **"C++를 사용한 데스크톱 개발"**을 체크하고 설치하시면 됩니다.
4. **WebView2 런타임**
   - Windows 10(최신 업데이트) 및 Windows 11에는 기본 내장되어 있으므로 별도 설치가 필요 없습니다.

---

## 🚀 윈도우 PC에서 실행하는 방법

### 1단계: 패키지 의존성 설치
폴더 안의 **`install.bat`** 파일을 더블 클릭하여 실행합니다. (또는 명령 프롬프트에서 `npm install` 실행)

### 2단계: 개발 모드로 즉시 실행
폴더 안의 **`dev.bat`** 파일을 더블 클릭하여 실행합니다. (또는 `npm run tauri dev` 실행)  
- 코드가 컴파일된 후 **Geditor** 창이 바로 화면에 나타납니다.

### 3단계: 배포용 실행 파일(`.exe`) 만들기
폴더 안의 **`build.bat`** 파일을 더블 클릭하여 실행합니다. (또는 `npm run tauri build` 실행)  
- 빌드가 완료되면 아래 위치에 설치 프로그램 및 단독 실행 파일이 생성됩니다:
  * **단독 실행 파일**: `src-tauri\target\release\geditor.exe`
  * **설치 프로그램 (Installer)**: `src-tauri\target\release\bundle\nsis\Geditor_0.1.0_x64-setup.exe`

---

## 📁 주요 폴더 및 파일 구조

```
geditor-windows/
├── install.bat          # 의존성 패키지 1클릭 설치 스크립트
├── dev.bat              # 윈도우 앱 즉시 실행 스크립트
├── build.bat            # 윈도우 .exe 배포 빌드 스크립트
├── README-WINDOWS.md    # 윈도우 가이드 문서 (본 문서)
├── package.json         # 프론트엔드 의존성 및 스크립트 설정
├── src/                 # React 19 + TypeScript + Monaco Editor 소스
│   ├── App.tsx          # 메인 UI 레이아웃 및 윈도우 단축키
│   ├── types.ts         # 윈도우 기본 폰트 및 설정 타입
│   ├── components/      # 메뉴바, 에디터, 터미널, 분할창, 환경설정 모달
│   └── services/        # Rust 코어와의 IPC 통신
└── src-tauri/           # Rust 코어 소스
    ├── Cargo.toml       # portable-pty, walkdir, encoding_rs 등 의존성
    ├── tauri.conf.json  # 윈도우 창 및 NSIS 인스톨러 패키징 설정
    └── src/
        ├── lib.rs       # 윈도우 시스템 메뉴 및 명령어 등록
        ├── pty_cmd.rs   # 윈도우 PowerShell 터미널 PTY 제어
        ├── fs_cmd.rs    # 초고속 파일 입출력 및 EUC-KR/UTF-8 자동 감지
        └── search_cmd.rs# 전역 정규식 파일 검색 엔진
```
