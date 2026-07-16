cask "omnio" do
  version "<VERSION>"

  on_intel do
    sha256 "<SHA256-DMG-X64>"
    url "https://github.com/TonyMontania/Omnio/releases/download/v#{version}/Omnio-Mac-#{version}-x64.dmg"
  end

  on_arm do
    sha256 "<SHA256-DMG-ARM64>"
    url "https://github.com/TonyMontania/Omnio/releases/download/v#{version}/Omnio-Mac-#{version}-arm64.dmg"
  end

  name "Omnio"
  desc "Local-first desktop app to track hobbies (games, music, movies, series, anime, comics)"
  homepage "https://github.com/TonyMontania/Omnio"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Omnio.app"

  zap trash: [
    "~/Library/Application Support/Omnio",
    "~/Library/Preferences/com.omnio.app.plist",
    "~/Library/Saved Application State/com.omnio.app.savedState",
    "~/Library/Logs/Omnio",
  ]
end
