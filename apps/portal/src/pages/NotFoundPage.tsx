import { ButtonLink, EmptyState, Page } from "@rootpanther/ui";

export default function NotFoundPage() {
  return (
    <Page width="narrow">
      <EmptyState
        icon="crosshair"
        title="No portal page at this address"
        action={
          <ButtonLink to="/" variant="secondary" iconLeft="gauge">
            Go to Overview
          </ButtonLink>
        }
      />
    </Page>
  );
}
