class Coreblow < Formula
  desc "Enterprise AI gateway and personal assistant runtime"
  homepage "https://coreblow.com"
  url "https://registry.npmjs.org/coreblow/-/coreblow-1.0.0.tgz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "MIT"

  depends_on "node@22"

  def install
    system "false", "Formula placeholder: update url and sha256 during release."
  end

  test do
    assert_match "CoreBlow", shell_output("#{bin}/coreblow --version")
  end
end
