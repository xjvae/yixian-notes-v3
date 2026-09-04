import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, FileText, FolderOpen, LayoutGrid } from 'lucide-react';
import { INote, INotebook, IWorkspace } from '@/data/notes';
import { cn } from '@/lib/utils';

interface NoteBreadcrumbProps {
  workspace: IWorkspace;
  notebook?: INotebook;
  note?: INote;
  notebooks?: INotebook[];
  sameNotebookNotes?: INote[];
  onSelectNote?: (id: string) => void;
  onSelectNotebook?: (id: string) => void;
  className?: string;
}

export default function NoteBreadcrumb({
  workspace,
  notebook,
  note,
  notebooks = [],
  sameNotebookNotes = [],
  onSelectNote,
  onSelectNotebook,
  className,
}: NoteBreadcrumbProps) {
  const hasNotesInNotebook = sameNotebookNotes.length > 0;

  return (
    <Breadcrumb className={cn('text-xs', className)}>
      <BreadcrumbList>
        {/* 工作区 */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link
              to="/notes"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <LayoutGrid className="size-3" />
              <span className="hidden sm:inline">{workspace.name}</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        {/* 笔记本（下拉快速切换） */}
        <BreadcrumbItem>
          {notebooks.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <FolderOpen className="size-3" />
                  <span className="max-w-[120px] truncate">
                    {notebook?.name ?? '未分类'}
                  </span>
                  <ChevronDown className="size-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {notebooks.map((nb) => (
                  <DropdownMenuItem
                    key={nb.id}
                    onClick={() => onSelectNotebook?.(nb.id)}
                    className="text-xs cursor-pointer"
                  >
                    <span
                      className="size-2 rounded-full mr-2 shrink-0"
                      style={{ backgroundColor: nb.color }}
                    />
                    {nb.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <BreadcrumbLink asChild>
              <Link
                to="/notes"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <FolderOpen className="size-3" />
                <span className="max-w-[120px] truncate">
                  {notebook?.name ?? '未分类'}
                </span>
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        {/* 笔记标题（当前页，下拉快速切换同笔记本笔记） */}
        <BreadcrumbItem>
          {hasNotesInNotebook ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-foreground font-medium group max-w-[200px]"
                >
                  <FileText className="size-3 text-primary shrink-0" />
                  <span className="truncate">{note?.title ?? '未命名笔记'}</span>
                  <ChevronDown className="size-3 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                {sameNotebookNotes.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={() => onSelectNote?.(n.id)}
                    className={`text-xs cursor-pointer flex-col items-start gap-0.5 py-2 ${
                      n.id === note?.id ? 'bg-accent/50' : ''
                    }`}
                  >
                    <span className="font-medium truncate w-full">{n.title}</span>
                    <span className="text-[10px] text-muted-foreground truncate w-full">
                      {n.excerpt.slice(0, 40)}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <BreadcrumbPage className="flex items-center gap-1 max-w-[200px]">
              <FileText className="size-3 text-primary shrink-0" />
              <span className="truncate">{note?.title ?? '未命名笔记'}</span>
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
