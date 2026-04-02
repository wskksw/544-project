"use client";

export function StudyContactBar({
  showAccessCodeHelp = false
}: {
  showAccessCodeHelp?: boolean;
}) {
  return (
    <aside className="study-contact-bar" aria-label="Study contact information">
      <div className="study-contact-bar-inner">
        <p>
          <strong>Need help during the study?</strong> Text or call Kevin Wang at{" "}
          <a href="tel:2368670839">236-867-0839</a> or email{" "}
          <a href="mailto:kevinwang1262000@gmail.com">kevinwang1262000@gmail.com</a>.
        </p>
        <p>
          <strong>Other study contacts:</strong> Yuri Kim{" "}
          <a href="mailto:yurikim1@cs.ubc.ca">yurikim1@cs.ubc.ca</a>
        </p>
        {showAccessCodeHelp ? (
          <p>
            <strong>Need an access code?</strong> Text Kevin for the code before starting.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
