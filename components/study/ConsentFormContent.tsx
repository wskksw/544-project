import { CONSENT_OPTION_YES } from "@/components/study/consent";

export function ConsentFormContent() {
  return (
    <>
      <section className="consent-copy-section">
        <p>
          <strong>THE UNIVERSITY OF BRITISH COLUMBIA</strong>
          <br />
          Department of Computer Science
          <br />
          2366 Main Mall
          <br />
          Vancouver, B.C., V6T 1Z4
          <br />
          Human-Computer Interaction Course Projects
        </p>
      </section>

      <section className="consent-copy-section">
        <p>
          <strong>Principal Investigator:</strong> Dongwook Yoon, Associate Professor, Department of Computer
          Science, University of British Columbia, <a href="mailto:yoon@cs.ubc.ca">yoon@cs.ubc.ca</a>, 604-822-1993
        </p>
        <p>
          <strong>Student Investigators:</strong> Kim, Yuri <a href="mailto:yurikim1@cs.ubc.ca">yurikim1@cs.ubc.ca</a>
          <br />
          Wang, Kevin <a href="mailto:kevinsk@student.ubc.ca">kevinsk@student.ubc.ca</a>
        </p>
      </section>

      <section className="consent-copy-section">
        <h2>Introduction</h2>
        <p>
          Thank you for considering participating in this study. This work is affiliated with the UBC course
          &quot;Human-Computer Interacion&quot; (CPSC 544). Please note that we are seeking people who have used AI chatbots
          (e.g., ChatGPT, Claude, Grammarly) at least a few times before and are open to using them for writing tasks.
        </p>
      </section>

      <section className="consent-copy-section">
        <h2>Purpose</h2>
        <p>
          The overall purpose of this research is to explore how people interact with different AI-assisted writing
          tools when composing messages to others.
        </p>
      </section>

      <section className="consent-copy-section">
        <h2>What you will be asked to do</h2>
        <p>After you have read this document, I/we will respond to any questions or concerns that you may have. Once you have signed this consent form, you will be asked to:</p>
        <ul>
          <li>Perform several tasks using a web-based interface</li>
          <li>Complete online questionnaires</li>
          <li>(Optional) Participate in a brief follow-up interview through zoom</li>
        </ul>
        <p>
          This should take about 30-45 minutes (or 45-60 minutes including the interview) and be completed in 1-2
          sessions.
        </p>
        <p>
          Some of the writing tasks may feel emotionally demanding because they ask you to reflect on interpersonal
          situations and compose personal messages.
        </p>
        <p>
          The interview session may also be video and/or audio recorded. You have the option not to be video/audio
          recorded.
        </p>
      </section>

      <section className="consent-copy-section">
        <h2>How the data collected will be used</h2>
        <p>
          Data collected (including any audio/video recordings) will be used for analysis and may also be used for
          class project presentations and other research presentations. Although only a course project in its current
          form, this project may, at a later date, be extended by one or more of the student investigators to be
          submitted as a research publication.
        </p>
      </section>

      <section className="consent-copy-section">
        <h2>Compensation</h2>
        <p>There is no compensation for participating in this study.</p>
      </section>

      <section className="consent-copy-section">
        <h2>Confidentiality</h2>
        <p>
          The results of your participation will be reported without any reference to you specifically. All information
          that you provide will be stored in Canada. It will be treated confidentially and your identity will not be
          revealed in reporting the study results. The two exceptions are: (1) excerpts from the video/audio recording
          in which a participant can be identified may be presented in a class project presentation (but any other
          presentation venue, such as a scholarly conference, will require that participants be non-identifiable in the
          video/images), and (2) we request but cannot enforce focus group members to keep discussions from any focus
          group confidential.
        </p>
      </section>

      <section className="consent-copy-section">
        <h2>Data retention</h2>
        <p>
          Identifiable data and video/audio recordings will be stored securely in a locked metal cabinet or in a
          password protected computer account. All digital data will be encrypted. All data from individual
          participants will be coded so that their anonymity will be protected in any reports, research papers, and
          presentations that result from this work.
        </p>
      </section>

      <section className="consent-copy-section">
        <h2>Protecting identities while using Zoom</h2>
        <p>
          If using Zoom, you can log in using only a nickname or a substitute name or research code given ahead of
          time by the researcher, you can turn off your camera, and you can mute your microphone (if it is not
          needed).
        </p>
      </section>

      <section className="consent-copy-section">
        <h2>Contact for information about the rights of research subjects</h2>
        <p>
          If you have any concerns or complaints about your rights as a research participant and/or your experiences
          while participating in this study, contact the Research Participant Complaint Line in the UBC Office of
          Research Ethics at 604-822-8598 or if long distance e-mail <a href="mailto:RSIL@ors.ubc.ca">RSIL@ors.ubc.ca</a> or
          call toll free 1-877-822-8598.
        </p>
      </section>

      <section className="consent-copy-section">
        <h2>Consent</h2>
        <p>
          By selecting the &quot;{CONSENT_OPTION_YES}&quot; option below and providing your full name and today&apos;s date, you
          confirm that you have read and understood the explanation about this study. You acknowledge that you have
          been given the opportunity to discuss it and my questions have been answered to my satisfaction. You consent
          to take part in this study, but you acknowledge that your participation is voluntary and you are free to
          withdraw at any time.
        </p>
      </section>
    </>
  );
}
