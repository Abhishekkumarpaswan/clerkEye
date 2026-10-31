import { LangProvider } from "@/components/lang-provider";
import { SkipLink } from "@/components/skip-link";
import { CheckWizard } from "@/components/check-wizard";

export const metadata = {
  title: "Check documents — ClerkEye",
};

export default async function CheckPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string }>;
}) {
  const params = await searchParams;
  return (
    <LangProvider>
      <SkipLink />
      <CheckWizard autoLoadSample={params.sample === "1"} />
    </LangProvider>
  );
}
