import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-sm text-slate-500">불러오는 중...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
