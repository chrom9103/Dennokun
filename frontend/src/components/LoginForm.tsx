"use client";

import { FormEvent, useState } from "react";
import { login, LoginCredentials } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Icon from "./ui/Icon";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const credentials: LoginCredentials = {
        username,
        password,
        remember_me: rememberMe,
      };

      await login(credentials);

      // Redirect to dashboard after successful login
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
          <Icon name="error_outline" size={20} />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <Input
          label="ユーザー名"
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={isLoading}
          placeholder="ユーザー名を入力"
          autoComplete="username"
        />

        <Input
          label="パスワード"
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          placeholder="パスワードを入力"
          autoComplete="current-password"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="remember_me"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer transition-all"
          />
          <label
            htmlFor="remember_me"
            className="text-sm text-muted-foreground cursor-pointer select-none"
          >
            ログイン状態を保持する
          </label>
        </div>
        
        <button type="button" className="text-sm text-primary hover:underline font-medium">
          パスワードを忘れた場合
        </button>
      </div>

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={isLoading}
      >
        ログイン
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">Demo Access</span>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground leading-relaxed">
        任意のユーザー名とパスワードでログイン可能です。<br />
        管理者権限が必要な場合はシードユーザーをご利用ください。
      </p>
    </form>
  );
}
