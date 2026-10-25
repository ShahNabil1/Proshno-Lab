import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CircleCheck, CircleX, Info, TriangleAlert, LoaderCircle, X } from "lucide-react";
import type { CSSProperties } from "react";
import "@/styles/notifications.css";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="site-toaster"
      position="top-center"
      offset={{ top: "80px" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 72px)", left: "16px", right: "16px" }}
      duration={2000}
      visibleToasts={2}
      expand
      closeButton
      pauseWhenPageIsHidden
      containerAriaLabel="নোটিফিকেশন"
      style={{ "--width": "440px" } as CSSProperties}
      icons={{
        success: <CircleCheck size={23} strokeWidth={2.2} />,
        error: <CircleX size={23} strokeWidth={2.2} />,
        info: <Info size={23} strokeWidth={2.2} />,
        warning: <TriangleAlert size={23} strokeWidth={2.2} />,
        loading: <LoaderCircle size={23} className="notification-spinner" />,
        close: <X size={15} />,
      }}
      toastOptions={{
        classNames: {
          toast: "site-notification",
          title: "site-notification-title",
          description: "site-notification-description",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
