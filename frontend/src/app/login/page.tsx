/**
 * Login page
 */
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <div className="w-full max-w-md px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4">
            <span className="material-icons-outlined text-white" style={{ fontSize: 32 }}>
              lock
            </span>
          </div>
          <h1 className="text-2xl font-normal text-foreground">
            大会管理システム
          </h1>
          <p className="text-muted-foreground mt-1">
            アカウントにログイン
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-[var(--shadow-sm)] p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
