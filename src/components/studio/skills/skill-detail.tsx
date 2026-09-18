import { motion } from "framer-motion";
import { Copy, FileCode2, Pencil, Trash2, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { SOURCE_META, type MySkill } from "./data";

/** Dark mono block that mimics the SKILL.md file of the skill. */
function SkillMdBlock({ code }: { code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-800 bg-stone-950">
      <div className="flex items-center justify-between border-b border-stone-800 px-4 py-2">
        <span className="flex items-center gap-2 text-stone-400">
          <FileCode2 className="size-3.5" aria-hidden="true" />
          <span className="font-mono text-[11px] tracking-wide">SKILL.md</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-stone-400 hover:bg-stone-800 hover:text-stone-200"
          aria-label="Скопировать SKILL.md"
        >
          <Copy className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      <pre className="vf-scroll overflow-x-auto p-4 font-mono text-xs leading-relaxed text-stone-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Expanded view of the selected skill: description, trigger chips,
 * the SKILL.md file body and the edit/duplicate/delete actions.
 */
export function SkillDetail({
  skill,
  onClose,
  onDuplicate,
  onDelete,
}: {
  skill: MySkill;
  onClose: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const source = SOURCE_META[skill.source];
  const Icon = skill.icon;

  return (
    <motion.section
      aria-label={`Скилл «${skill.name}»`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Card className="border-primary/30">
        <div className="flex items-start gap-4 px-6 pt-6">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Icon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold leading-tight">
                {skill.name}
              </h3>
              <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                v{skill.version}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  source.className,
                )}
              >
                {source.label}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {skill.description}. Скилл срабатывает, когда оркестратор видит
              похожую задачу в чате — триггеры можно менять в файле SKILL.md.
            </p>
            <ul
              className="mt-2.5 flex flex-wrap gap-1.5"
              aria-label="Триггеры скилла"
            >
              {skill.triggers.map((trigger) => (
                <li
                  key={trigger}
                  className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  <Zap className="size-3 text-primary" aria-hidden="true" />
                  <span className="font-mono">{trigger}</span>
                </li>
              ))}
            </ul>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onClose}
            aria-label="Закрыть детали скилла"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <CardContent className="mt-5">
          <SkillMdBlock code={skill.skillMd} />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm">
              <Pencil className="size-3.5" aria-hidden="true" />
              Изменить
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDuplicate(skill.id)}
            >
              <Copy className="size-3.5" aria-hidden="true" />
              Дублировать
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(skill.id)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Удалить
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}
