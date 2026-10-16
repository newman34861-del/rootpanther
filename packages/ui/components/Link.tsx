import { createContext, forwardRef, useContext } from "react";
import type { AnchorHTMLAttributes, ForwardRefExoticComponent, ReactNode, RefAttributes } from "react";

export interface UiLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  children?: ReactNode;
}

type LinkImpl = ForwardRefExoticComponent<UiLinkProps & RefAttributes<HTMLAnchorElement>>;

const DefaultLink = forwardRef<HTMLAnchorElement, UiLinkProps>(function DefaultLink({ to, ...rest }, ref) {
  return <a ref={ref} href={to} {...rest} />;
});

const LinkContext = createContext<LinkImpl>(DefaultLink);

export function LinkProvider({ component, children }: { component: LinkImpl; children: ReactNode }) {
  return <LinkContext.Provider value={component}>{children}</LinkContext.Provider>;
}

export function isExternal(to: string): boolean {
  return /^(https?:)?\/\//.test(to) || to.startsWith("mailto:");
}

export const UiLink = forwardRef<HTMLAnchorElement, UiLinkProps>(function UiLink(props, ref) {
  const Impl = useContext(LinkContext);
  if (isExternal(props.to)) {
    const { to, ...rest } = props;
    return <a ref={ref} href={to} {...rest} />;
  }
  return <Impl ref={ref} {...props} />;
});
