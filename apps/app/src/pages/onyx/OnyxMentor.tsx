import { Card, Icon, OnyxPanel, PlanRequired, ButtonLink, ErrorState } from "@rootpanther/ui";
import { currentUser } from "../../mock/account";
import { mentorReply, mentorTranscript, MENTOR_START, suggestedQuestions } from "../../mock/onyx";
import { useOnyxChat } from "./onyxChat";
import type { DataState } from "../../review/review";

export function OnyxMentor({ state }: { state: DataState }) {
  const chat = useOnyxChat({
    initialMessages: mentorTranscript,
    initialLevel: currentUser.helpDefault,
    initialCtx: MENTOR_START,
    respond: mentorReply,
  });

  if (state === "denied") {
    return (
      <Card padding="lg">
        <PlanRequired
          title="Mentor mode is part of an active plan."
          plan="Practitioner"
          includes={["Onyx mentor chat at every help level", "Concept primers for your tier", "Scored drills that use no lab hours", "Methodology playbooks and conversation history"]}
          action={
            <ButtonLink to="/billing" variant="primary" iconLeft="refresh">
              Reactivate for $49 / month
            </ButtonLink>
          }
        />
      </Card>
    );
  }
  if (state === "error") {
    return (
      <Card>
        <ErrorState title="Onyx is unreachable" onRetry={() => window.location.reload()} reference="req_mn7731">
          The mentor service did not respond. Primers, drills and playbooks still work offline of it.
        </ErrorState>
      </Card>
    );
  }

  return (
    <div className="ox-mentor">
      <div className="ox-panelframe">
        <div className="ox-mentornote">
          <Icon name="info" size={15} />
          <span>Mentor mode has no live lab, so answers are general methodology and not tied to a scenario. Start a lab to ground Onyx to its hosts.</span>
        </div>
        <OnyxPanel
          level={chat.level}
          onLevelChange={chat.setLevel}
          messages={chat.messages}
          onSend={chat.send}
          onCommand={chat.runCommand}
          connection={chat.busy ? "streaming" : "ready"}
        />
      </div>
      <aside className="ox-aside ox-mentor__aside" aria-label="Suggested questions">
        <Card title="Suggested questions" tone="inset">
          <div className="ox-suggest">
            {suggestedQuestions.map((q) => (
              <button key={q} type="button" className="ox-suggest__q" onClick={() => chat.send(q)} disabled={chat.busy || chat.level === "exam-sim"}>
                {q}
              </button>
            ))}
          </div>
        </Card>
        <p className="ox-asidefoot">
          Hints escalate when you ask again about the same blocker. Walkthrough gives concrete steps and asks you to confirm first.
        </p>
      </aside>
    </div>
  );
}
