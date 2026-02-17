import { ReactNode } from "react";
import QuestionFilterPanel from "@/components/QuestionFilterPanel";

interface QuestionPageLayoutProps {
  title: string;
  subtitle: string;
  bannerClass: string;
  children: ReactNode;
}

export default function QuestionPageLayout({ title, subtitle, bannerClass, children }: QuestionPageLayoutProps) {
  return (
    <div>
      <div className={`${bannerClass} py-10 md:py-14`}>
        <div className="container text-center">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground">{title}</h1>
          <p className="text-primary-foreground/80 mt-2">{subtitle}</p>
        </div>
      </div>

      <div className="container py-8">
        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-8">
          <div>
            <div className="lg:hidden mb-6">
              <QuestionFilterPanel />
            </div>
            {children}
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <QuestionFilterPanel />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
