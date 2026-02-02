import { Moon, Sun, Monitor } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemePersistence } from "@/hooks/useThemePersistence";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light" as const, label: "Claro", icon: Sun },
  { value: "dark" as const, label: "Escuro", icon: Moon },
  { value: "system" as const, label: "Sistema", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useThemePersistence();

  const currentTheme = themes.find((t) => t.value === theme) || themes[1];
  const Icon = currentTheme.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 touch-target relative overflow-hidden"
        >
          <motion.div
            key={theme}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <Icon className="h-5 w-5" />
          </motion.div>
          <span className="sr-only">Alternar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass">
        {themes.map((t) => {
          const ThemeIcon = t.icon;
          const isActive = theme === t.value;

          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                isActive && "bg-primary/10 text-primary"
              )}
            >
              <motion.div
                className="flex items-center gap-2 w-full"
                whileHover={{ x: 2 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <ThemeIcon className="h-4 w-4" />
                <span>{t.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTheme"
                    className="ml-auto h-2 w-2 rounded-full bg-primary"
                  />
                )}
              </motion.div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
