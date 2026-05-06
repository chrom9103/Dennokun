/**
 * Login form component
 */
"use client";

import { FormEvent, useState } from "react";
import { login, LoginCredentials } from "@/lib/auth";
import { useRouter } from "next/navigation";

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
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="username">ユーザー名</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="password">パスワード</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div>
        <label htmlFor="remember_me">
          <input
            type="checkbox"
            id="remember_me"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
          />
          ログイン状態を保持する
        </label>
      </div>

      {error && (
        <div style={{ color: "red", marginBottom: "1em" }}>
          <p>{error}</p>
        </div>
      )}

      <button type="submit" disabled={isLoading}>
        {isLoading ? "ログイン中..." : "ログイン"}
      </button>
    </form>
  );
}
