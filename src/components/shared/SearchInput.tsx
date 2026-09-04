import { forwardRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** 带放大镜图标的搜索输入框，统一各页 `Search 图标 + Input(pl-9)` 骨架 */
export const SearchInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  function SearchInput(props, ref) {
    return (
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input ref={ref} className="pl-9" {...props} />
      </div>
    );
  },
);