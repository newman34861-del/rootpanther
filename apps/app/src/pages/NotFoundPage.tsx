import { ButtonLink, EmptyState, Page } from "@rootpanther/ui";

export function NotFoundPage() {
  return (
    <Page width="narrow">
      <EmptyState icon="crosshair" title="No page at this address" action={<ButtonLink to="/" variant="secondary" iconLeft="home">Go to Home</ButtonLink>}>
        The link may be out of date, or the page was moved.
      </EmptyState>
    </Page>
  );
}
