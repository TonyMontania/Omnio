// Open a folder, or show a file inside its folder, in the OS file manager.
//
// Windows' explorer.exe falls back to Documents whenever it can't parse
// its argument: forward slashes, a `\\?\` verbatim prefix, or the whole
// `/select,<path>` wrapped in quotes (what std's argument quoting does
// as soon as the path has a space). So the path is normalised first and
// passed as a raw argument with only the path itself quoted.

use std::path::Path;
use std::process::Command;

/// Windows-friendly form of `path`: backslashes, no verbatim prefix.
#[cfg_attr(not(windows), allow(dead_code))]
pub fn windows_path(path: &Path) -> String {
    let s = path.to_string_lossy().replace('/', "\\");
    if let Some(rest) = s.strip_prefix("\\\\?\\UNC\\") {
        format!("\\\\{rest}")
    } else if let Some(rest) = s.strip_prefix("\\\\?\\") {
        rest.to_string()
    } else {
        s
    }
}

/// Opens `dir` in the file manager.
pub fn open_folder(dir: &Path) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("explorer.exe").raw_arg(format!("\"{}\"", windows_path(dir))).spawn().is_ok()
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(dir).spawn().is_ok()
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(dir).spawn().is_ok()
    }
}

/// Opens the folder holding `file` with the file selected. Falls back to
/// opening the folder when the file is gone or the platform can't select.
pub fn reveal_file(file: &Path) -> bool {
    if !file.exists() {
        return match file.parent() {
            Some(parent) if parent.exists() => open_folder(parent),
            _ => false,
        };
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        Command::new("explorer.exe").raw_arg(format!("/select,\"{}\"", windows_path(file))).spawn().is_ok()
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg("-R").arg(file).spawn().is_ok()
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        open_folder(file.parent().unwrap_or(Path::new(".")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalises_slashes_and_verbatim_prefixes() {
        assert_eq!(windows_path(Path::new("F:/Omnio data/saves/My Game")), "F:\\Omnio data\\saves\\My Game");
        assert_eq!(windows_path(Path::new("\\\\?\\C:\\Users\\me\\saves")), "C:\\Users\\me\\saves");
        assert_eq!(windows_path(Path::new("\\\\?\\UNC\\nas\\share\\x")), "\\\\nas\\share\\x");
        assert_eq!(windows_path(Path::new("C:\\plain\\path")), "C:\\plain\\path");
    }
}
