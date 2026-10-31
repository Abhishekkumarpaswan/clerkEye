import { LangProvider } from "@/components/lang-provider";
import { SkipLink } from "@/components/skip-link";
import { Landing } from "@/components/landing";

export default function Home() {
  return (
    <LangProvider>
      <SkipLink />
      <Landing />
    </LangProvider>
  );
}
