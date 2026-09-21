using System.IO;
using MonitoringAgent.Worker.Services;

namespace MonitoringAgent.App;

public enum AppLanguage
{
    Korean = 0,
    Japanese = 1,
    English = 2,
}

public static class Loc
{
    public static AppLanguage Current { get; private set; } = AppLanguage.Korean;

    private static readonly string ConfigPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MonitoringAgent", "ui-language.txt");

    private static readonly Dictionary<string, string[]> Table = new()
    {
        ["app.name"] = new[] { "Monitoring Agent", "Monitoring Agent", "Monitoring Agent" },

        ["lang.title"] = new[] { "언어를 선택하세요", "言語を選択してください", "Choose your language" },
        ["lang.subtitle"] = new[]
        {
            "사용할 언어를 선택하고 다음을 눌러주세요.",
            "使用する言語を選択して「次へ」を押してください。",
            "Select a language and tap Next.",
        },
        ["lang.next"] = new[] { "다음", "次へ", "Next" },
        ["lang.change"] = new[] { "언어 변경", "言語を変更", "Change language" },

        ["start.title"] = new[]
        {
            "모니터링 에이전트를\n설치할게요",
            "モニタリングエージェントを\nインストールします",
            "Let's install the\nMonitoring Agent",
        },
        ["start.subtitle"] = new[]
        {
            "이 서버의 로그와 CPU·메모리·디스크 사용량을\nMonitoring Platform 으로 보내요.",
            "このサーバーのログと CPU・メモリ・ディスク使用量を\nMonitoring Platform へ送信します。",
            "It sends this server's logs and CPU, memory and\ndisk usage to the Monitoring Platform.",
        },
        ["start.infoTitle"] = new[] { "보내는 정보는 이것뿐이에요", "送信する情報はこれだけです", "This is all it sends" },
        ["start.infoBody"] = new[]
        {
            "• 고른 경로의 로그 파일에 새로 쓰인 줄\n• CPU·메모리·디스크·네트워크 사용량\n• 호스트명, OS, IP 주소",
            "• 選んだパスのログファイルに新しく書かれた行\n• CPU・メモリ・ディスク・ネットワーク使用量\n• ホスト名、OS、IP アドレス",
            "• New lines written to the log files you choose\n• CPU, memory, disk and network usage\n• Hostname, OS and IP address",
        },
        ["start.button"] = new[] { "시작하기", "始める", "Get started" },
        ["start.footer"] = new[]
        {
            "문서나 개인 파일은 읽지 않아요",
            "文書や個人ファイルは読み取りません",
            "Documents and personal files are never read",
        },

        ["connect.title"] = new[] { "플랫폼과 연결할게요", "プラットフォームに接続します", "Connect to the platform" },
        ["connect.subtitle"] = new[]
        {
            "프로젝트의 에이전트 탭에서 발급한\n서버 주소와 토큰을 붙여넣어 주세요.",
            "プロジェクトのエージェントタブで発行した\nサーバーアドレスとトークンを貼り付けてください。",
            "Paste the server address and token issued\nin the project's Agents tab.",
        },
        ["connect.server"] = new[] { "서버 주소", "サーバーアドレス", "Server address" },
        ["connect.token"] = new[] { "에이전트 토큰", "エージェントトークン", "Agent token" },
        ["connect.button"] = new[] { "연결 확인", "接続を確認", "Check connection" },
        ["connect.checking"] = new[] { "확인하고 있어요...", "確認しています...", "Checking..." },
        ["connect.back"] = new[] { "이전", "戻る", "Back" },
        ["connect.err.empty"] = new[]
        {
            "서버 주소와 토큰을 모두 입력해주세요.",
            "サーバーアドレスとトークンを入力してください。",
            "Enter both the server address and the token.",
        },
        ["connect.err.url"] = new[]
        {
            "서버 주소는 http:// 또는 https:// 로 시작해야 해요.",
            "サーバーアドレスは http:// または https:// で始めてください。",
            "The server address must start with http:// or https://.",
        },
        ["connect.ok"] = new[]
        {
            "{0} 프로젝트의 {1} 에이전트로 연결됐어요",
            "{0} プロジェクトの {1} エージェントとして接続しました",
            "Connected as agent {1} of project {0}",
        },

        ["logs.title"] = new[] { "수집할 로그를 골라주세요", "収集するログを選んでください", "Choose the logs to collect" },
        ["logs.subtitle"] = new[]
        {
            "고른 경로에서 새로 쌓이는 줄만 보내요.\n로그 없이도 서버 자원은 수집해요.",
            "選んだパスに新しく追加された行だけを送ります。\nログがなくてもサーバーリソースは収集します。",
            "Only new lines from the chosen paths are sent.\nServer resources are collected either way.",
        },
        ["logs.addFolder"] = new[] { "폴더 추가", "フォルダーを追加", "Add folder" },
        ["logs.add"] = new[] { "추가", "追加", "Add" },
        ["logs.pattern"] = new[] { "경로 직접 입력", "パスを直接入力", "Enter a path" },
        ["logs.empty"] = new[]
        {
            "아직 고른 로그가 없어요.",
            "まだログが選ばれていません。",
            "No logs chosen yet.",
        },
        ["logs.suggest"] = new[] { "이 서버에서 찾은 로그 폴더", "このサーバーで見つかったログフォルダー", "Log folders found on this server" },
        ["logs.files"] = new[] { "지금 파일 {0}개", "現在ファイル {0} 件", "{0} files now" },
        ["logs.button"] = new[] { "설치하고 시작하기", "インストールして開始", "Install and start" },
        ["logs.folderDialog"] = new[]
        {
            "로그 파일이 있는 폴더를 고르세요",
            "ログファイルがあるフォルダーを選んでください",
            "Choose the folder that holds the log files",
        },

        ["progress.title"] = new[] { "설치하고 있어요", "インストールしています", "Installing..." },
        ["progress.status"] = new[] { "잠시만 기다려 주세요", "少々お待ちください", "Please wait a moment" },
        ["progress.install.title"] = new[] { "서비스로 설치하고 있어요", "サービスとしてインストールしています", "Installing as a service..." },
        ["progress.install.status"] = new[]
        {
            "관리자 권한 승인이 필요해요 (UAC)",
            "管理者権限の承認が必要です（UAC）",
            "Administrator approval is required (UAC)",
        },
        ["progress.first.title"] = new[] { "첫 데이터를 보내고 있어요", "最初のデータを送信しています", "Sending the first data..." },

        ["step.install.ok"] = new[]
        {
            "Windows 서비스로 설치 완료",
            "Windows サービスとしてインストール完了",
            "Installed as a Windows service",
        },
        ["step.install.skip"] = new[]
        {
            "서비스 설치 건너뜀, 로그인한 동안 실행돼요",
            "サービスのインストールをスキップ、ログイン中に実行されます",
            "Service install skipped, runs while you are signed in",
        },
        ["step.config"] = new[] { "설정 저장 완료", "設定の保存が完了", "Settings saved" },
        ["step.config.fail"] = new[] { "설정을 저장하지 못했어요", "設定を保存できませんでした", "Could not save settings" },
        ["step.metrics"] = new[] { "서버 자원 측정 완료", "サーバーリソースの計測が完了", "Server resources measured" },
        ["step.send.ok"] = new[] { "플랫폼 전송 확인", "プラットフォームへの送信を確認", "Delivery to the platform confirmed" },
        ["step.send.fail"] = new[]
        {
            "플랫폼 전송 실패, 백그라운드에서 다시 시도해요",
            "送信に失敗、バックグラウンドで再試行します",
            "Delivery failed, retrying in the background",
        },

        ["done.subtitle.ok"] = new[]
        {
            "이제 백그라운드에서 계속 보내요",
            "これからバックグラウンドで送信し続けます",
            "It will keep sending in the background",
        },
        ["done.subtitle.offline"] = new[]
        {
            "설치는 끝났어요. 서버 연결은 백그라운드에서 계속 시도해요",
            "インストールは完了しました。サーバー接続はバックグラウンドで試み続けます",
            "Installed. It keeps retrying the server connection in the background",
        },
        ["done.close"] = new[] { "닫기", "閉じる", "Close" },

        ["row.project"] = new[] { "프로젝트", "プロジェクト", "Project" },
        ["row.agent"] = new[] { "에이전트", "エージェント", "Agent" },
        ["row.hostname"] = new[] { "호스트명", "ホスト名", "Hostname" },
        ["row.server"] = new[] { "서버 주소", "サーバー", "Server" },
        ["row.logs"] = new[] { "수집 로그", "収集ログ", "Logs" },
        ["row.metrics"] = new[] { "서버 자원", "サーバーリソース", "Resources" },
        ["row.usage"] = new[] { "CPU / 메모리", "CPU / メモリ", "CPU / Memory" },
        ["row.send"] = new[] { "전송", "送信", "Delivery" },
        ["row.background"] = new[] { "실행 방식", "実行方式", "Runs as" },

        ["val.logs"] = new[] { "경로 {0}개", "パス {0} 件", "{0} paths" },
        ["val.logs.none"] = new[] { "없음 (자원만 수집)", "なし（リソースのみ）", "None (resources only)" },
        ["val.metrics"] = new[] { "{0}초마다", "{0} 秒ごと", "Every {0}s" },
        ["val.send.ok"] = new[] { "정상", "正常", "OK" },
        ["val.send.fail"] = new[] { "실패 (재시도 중)", "失敗（再試行中）", "Failed (retrying)" },
        ["val.bg.service"] = new[] { "Windows 서비스", "Windows サービス", "Windows service" },
        ["val.bg.user"] = new[] { "로그인 시 자동 시작", "ログイン時に自動起動", "Starts at sign-in" },
        ["val.bg.fail"] = new[] { "등록 실패", "登録に失敗", "Registration failed" },
        ["val.dash"] = new[] { "-", "-", "-" },

        ["tray.status.service"] = new[] { "서비스로 실행 중", "サービスとして実行中", "Running as a service" },
        ["tray.status.running"] = new[] { "백그라운드 실행 중", "バックグラウンド実行中", "Running in background" },
        ["tray.status.stopped"] = new[] { "수집이 멈춰 있어요", "収集が停止しています", "Collection is stopped" },
        ["tray.row.project"] = new[] { "프로젝트", "プロジェクト", "Project" },
        ["tray.row.server"] = new[] { "서버 연결", "サーバー接続", "Server" },
        ["tray.row.heartbeat"] = new[] { "최근 신호", "最新シグナル", "Last signal" },
        ["tray.row.logs"] = new[] { "최근 로그 전송", "最新ログ送信", "Last log sent" },
        ["tray.row.sent"] = new[] { "보낸 로그", "送信したログ", "Logs sent" },
        ["tray.row.files"] = new[] { "지켜보는 파일", "監視中のファイル", "Watched files" },
        ["tray.row.spool"] = new[] { "보관 중", "保管中", "Queued" },
        ["tray.val.connected"] = new[] { "연결됨", "接続済み", "Connected" },
        ["tray.val.disconnected"] = new[] { "끊김 (재시도 중)", "切断（再試行中）", "Disconnected (retrying)" },
        ["tray.val.checking"] = new[] { "확인 중", "確認中", "Checking" },
        ["tray.val.count"] = new[] { "{0}건", "{0} 件", "{0}" },
        ["tray.val.files"] = new[] { "{0}개", "{0} 件", "{0}" },
        ["tray.val.spool"] = new[] { "{0}묶음", "{0} 件", "{0} batches" },
        ["tray.btn.sync"] = new[] { "지금 보내기", "今すぐ送信", "Send now" },
        ["tray.btn.syncing"] = new[] { "보내는 중...", "送信中...", "Sending..." },
        ["tray.btn.openLog"] = new[] { "로그 폴더 열기", "ログフォルダーを開く", "Open log folder" },
        ["tray.btn.quit"] = new[] { "종료", "終了", "Quit" },
        ["tray.btn.closeTray"] = new[] { "트레이 닫기", "トレイを閉じる", "Close tray" },
        ["tray.disableAutostart"] = new[] { "자동 시작 끄고 종료", "自動起動をオフにして終了", "Turn off auto-start and quit" },
        ["tray.tooltip"] = new[] { "Monitoring Agent 실행 중", "Monitoring Agent 実行中", "Monitoring Agent running" },
        ["tray.hint"] = new[]
        {
            "트레이에서 계속 실행 중이에요. 아이콘을 누르면 상태를 볼 수 있어요.",
            "トレイで実行中です。アイコンをクリックすると状態を確認できます。",
            "Still running in the tray. Click the icon to see the status.",
        },

        ["reason.Unauthorized"] = new[]
        {
            "토큰이 올바르지 않아요. 에이전트 탭에서 발급한 토큰인지 확인해 주세요.",
            "トークンが正しくありません。エージェントタブで発行したトークンか確認してください。",
            "The token is not valid. Check that it was issued in the Agents tab.",
        },
        ["reason.Unreachable"] = new[]
        {
            "서버에 연결할 수 없어요. 주소·포트·방화벽을 확인해 주세요.",
            "サーバーに接続できません。アドレス・ポート・ファイアウォールを確認してください。",
            "Cannot reach the server. Check the address, port and firewall.",
        },
        ["reason.Timeout"] = new[]
        {
            "서버 응답이 늦어요. 잠시 후 다시 시도해요.",
            "サーバーの応答が遅れています。しばらくして再試行します。",
            "The server is slow to respond. It will retry shortly.",
        },
        ["reason.ServerError"] = new[]
        {
            "서버에서 오류가 났어요. 잠시 후 다시 시도해요.",
            "サーバーでエラーが発生しました。しばらくして再試行します。",
            "The server returned an error. It will retry shortly.",
        },
        ["reason.RateLimited"] = new[]
        {
            "요청이 너무 많아 잠시 쉬었다 보내요.",
            "リクエストが多いため少し待ってから送信します。",
            "Too many requests, waiting a moment before sending.",
        },
        ["reason.TooLarge"] = new[]
        {
            "한 번에 보내는 양이 너무 커요.",
            "一度に送る量が大きすぎます。",
            "The batch is too large.",
        },
        ["reason.BadResponse"] = new[]
        {
            "서버가 요청을 처리하지 못했어요. 서버 주소를 확인해 주세요.",
            "サーバーがリクエストを処理できませんでした。アドレスを確認してください。",
            "The server could not process the request. Check the address.",
        },
        ["reason.NotConfigured"] = new[]
        {
            "서버 주소와 토큰이 설정되지 않았어요.",
            "サーバーアドレスとトークンが設定されていません。",
            "The server address and token are not set.",
        },
        ["reason.Unknown"] = new[]
        {
            "서버와 통신하지 못했어요.",
            "サーバーと通信できませんでした。",
            "Could not talk to the server.",
        },

        ["uninstall.title"] = new[] { "에이전트를 삭제할까요?", "エージェントを削除しますか？", "Remove the agent?" },
        ["uninstall.subtitle"] = new[]
        {
            "서비스를 멈추고 설치된 파일과 설정을 지워요.\n플랫폼에 쌓인 데이터는 그대로 남아요.",
            "サービスを停止し、ファイルと設定を削除します。\nプラットフォームのデータはそのまま残ります。",
            "It stops the service and removes its files and settings.\nData already on the platform stays.",
        },
        ["uninstall.delete"] = new[] { "삭제하기", "削除する", "Remove" },
        ["uninstall.deleting"] = new[] { "삭제 중...", "削除中...", "Removing..." },
        ["uninstall.cancel"] = new[] { "취소", "キャンセル", "Cancel" },
        ["uninstall.err.uac"] = new[]
        {
            "관리자 권한이 필요해요. (UAC 취소됨)",
            "管理者権限が必要です。（UAC がキャンセルされました）",
            "Administrator rights are required. (UAC canceled)",
        },
        ["uninstall.done"] = new[]
        {
            "Monitoring Agent 를 삭제했어요.",
            "Monitoring Agent を削除しました。",
            "Monitoring Agent has been removed.",
        },

        ["error.unexpected"] = new[]
        {
            "처리 중 예기치 못한 문제가 발생했어요.",
            "処理中に予期しない問題が発生しました。",
            "Something unexpected went wrong.",
        },
    };

    public static string T(string key)
    {
        if (Table.TryGetValue(key, out var variants) && (int)Current < variants.Length)
        {
            return variants[(int)Current];
        }
        return key;
    }

    public static string T(string key, params object[] args) => string.Format(T(key), args);

    public static string Variant(string key, int langIndex)
    {
        if (Table.TryGetValue(key, out var variants) && langIndex >= 0 && langIndex < variants.Length)
        {
            return variants[langIndex];
        }
        return key;
    }

    public static string Reason(ServerReason reason) => T("reason." + reason);

    public static void Set(AppLanguage language) => Current = language;

    public static AppLanguage LoadSaved()
    {
        try
        {
            if (File.Exists(ConfigPath) && Enum.TryParse(File.ReadAllText(ConfigPath).Trim(), out AppLanguage saved))
            {
                Current = saved;
                return saved;
            }
        }
        catch { }
        return Current;
    }

    public static void Save(AppLanguage language)
    {
        try
        {
            var dir = Path.GetDirectoryName(ConfigPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }
            File.WriteAllText(ConfigPath, language.ToString());
        }
        catch { }
    }
}
