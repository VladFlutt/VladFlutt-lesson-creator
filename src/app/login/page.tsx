import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <LoginForm initialMode={mode === "signup" ? "signup" : "signin"} />;
}
