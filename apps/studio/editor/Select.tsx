import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type SelectHTMLAttributes,
  type ReactNode,
} from 'react';
import { FilterSelect, type FilterOption } from '@lzzhu/presentation/filter-select';
import { initFilterSelect } from '@lzzhu/presentation/filter-select/behavior';
import '@lzzhu/presentation/styles/filter-select.css';
import './select.css';

/** React form adapter for the same keyboard/popup control used on the public site. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId(),
    host = useRef<HTMLSpanElement>(null);
  const controller = useRef<ReturnType<typeof initFilterSelect> | null>(null);
  const options: FilterOption[] = [];
  const visit = (children: ReactNode) =>
    Children.forEach(children, (child) => {
      if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child))
        return;
      if (child.type === 'option') {
        const label = Children.toArray(child.props.children).join('');
        options.push({ value: String(child.props.value ?? label), label, disabled: child.props.disabled });
      } else visit(child.props.children);
    });
  visit(props.children);
  const signature = JSON.stringify(options);
  const { 'aria-label': ariaLabel, 'aria-labelledby': labelledBy, id: controlId } = props;
  useEffect(() => {
    const root = host.current!.querySelector<HTMLElement>('[data-filter-select]')!;
    const native = root.querySelector('select')!;
    const trigger = root.querySelector<HTMLButtonElement>('[data-filter-trigger]')!;
    const label = host.current!.closest('label');
    if (!ariaLabel && label) {
      const copy = label.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('[data-studio-select]').forEach((el) => el.remove());
      const name = copy.textContent?.trim() || 'Choose an option';
      trigger.setAttribute('aria-label', name);
      root.querySelector('[role="listbox"]')!.setAttribute('aria-label', name);
    }
    if (labelledBy) trigger.setAttribute('aria-labelledby', labelledBy);
    if (controlId) trigger.id = controlId;
    // Only the visible control participates in the accessibility tree.
    native.setAttribute('aria-hidden', 'true');
    controller.current = initFilterSelect(root);
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
    // The option signature stands in for the children it was derived from.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, ariaLabel, labelledBy, controlId]);
  useLayoutEffect(() => controller.current?.sync());
  const { children: _children, id: _id, className, ...nativeProps } = props;
  return (
    <span ref={host} className={'studio-select ' + (className || '')} data-studio-select>
      <FilterSelect
        id={'select-' + id}
        name={props.name || id}
        label={props['aria-label'] || ''}
        options={options}
        selectProps={{ ...nativeProps, disabled: props.disabled ?? false }}
      />
    </span>
  );
}
