"use client";

import { SurveyQuestionField, type SurveyValue } from "@/components/surveys/SurveyQuestionField";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { RoleCondition, SurveyItem, SurveyTemplate } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function blankItem(index: number): SurveyItem {
  return {
    id: `item_${index + 1}`,
    prompt: "",
    type: "open_text",
    required: true,
    condition: "all"
  };
}

function visibleSurveyItems(template: SurveyTemplate, condition?: RoleCondition): SurveyItem[] {
  if (!condition) {
    return template.items;
  }

  return template.items.filter((item) => item.condition === "all" || item.condition === condition);
}

export function ResearcherSurveyArea() {
  const [templates, setTemplates] = useState<SurveyTemplate[] | null>(null);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [message, setMessage] = useState("");
  const [previewCondition, setPreviewCondition] = useState<RoleCondition>("drafter");
  const [previewPerConditionAnswers, setPreviewPerConditionAnswers] = useState<Record<string, SurveyValue>>({});
  const [previewPostStudyAnswers, setPreviewPostStudyAnswers] = useState<Record<string, SurveyValue>>({});

  async function loadTemplates(): Promise<void> {
    const response = await fetch("/api/researcher/surveys", { cache: "no-store" });
    const json = (await response.json()) as { templates: SurveyTemplate[] };
    setTemplates(json.templates);
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function saveTemplates(): Promise<void> {
    if (!templates) {
      return;
    }

    setSavingTemplates(true);
    setMessage("");

    try {
      const response = await fetch("/api/researcher/surveys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates })
      });

      const json = (await response.json()) as { templates?: SurveyTemplate[]; error?: string };
      if (!response.ok || !json.templates) {
        throw new Error(json.error ?? "Failed to save templates");
      }

      setTemplates(json.templates);
      setMessage("Survey templates saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSavingTemplates(false);
    }
  }

  function updateTemplate(
    templateId: SurveyTemplate["id"],
    updater: (template: SurveyTemplate) => SurveyTemplate
  ): void {
    setTemplates((prev) => {
      if (!prev) {
        return prev;
      }
      return prev.map((template) => (template.id === templateId ? updater(template) : template));
    });
  }

  function updateItem(
    templateId: SurveyTemplate["id"],
    itemIndex: number,
    updater: (item: SurveyItem) => SurveyItem
  ): void {
    updateTemplate(templateId, (template) => ({
      ...template,
      items: template.items.map((item, index) => (index === itemIndex ? updater(item) : item))
    }));
  }

  const perConditionTemplate = useMemo(
    () => templates?.find((template) => template.id === "per_condition") ?? null,
    [templates]
  );
  const postStudyTemplate = useMemo(
    () => templates?.find((template) => template.id === "post_study") ?? null,
    [templates]
  );

  const previewPerConditionItems = useMemo(
    () =>
      perConditionTemplate
        ? visibleSurveyItems(perConditionTemplate, previewCondition)
        : [],
    [perConditionTemplate, previewCondition]
  );

  return (
    <div className="layout-grid">
      <Card>
        <CardHeader>
          <CardTitle>Survey Area</CardTitle>
          <CardDescription>
            Edit per-condition and post-study templates, preview participant view, and export survey data.
          </CardDescription>
        </CardHeader>

        <CardContent className="row-wrap">
          <Link className={buttonVariants({ variant: "outline" })} href="/researcher">
            Back To Participant Dash
          </Link>
          <a
            className={buttonVariants({ variant: "outline" })}
            href="/api/researcher/export/surveys-csv"
            target="_blank"
            rel="noreferrer"
          >
            Export Survey CSV
          </a>
          <a
            className={buttonVariants({ variant: "outline" })}
            href="/api/researcher/export"
            target="_blank"
            rel="noreferrer"
          >
            Export Full JSON
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Survey Editor</CardTitle>
        </CardHeader>

        <CardContent className="stack-md">
          {templates?.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle>
                  {template.id === "per_condition" ? "Per-Condition Template" : "Post-Study Template"}
                </CardTitle>
              </CardHeader>

              <CardContent className="stack-md">
                <Label>
                  Title
                  <Input
                    value={template.title}
                    onChange={(event) =>
                      updateTemplate(template.id, (current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </Label>

                <Label>
                  Intro
                  <Textarea
                    value={template.intro}
                    onChange={(event) =>
                      updateTemplate(template.id, (current) => ({ ...current, intro: event.target.value }))
                    }
                  />
                </Label>

                {template.items.map((item, itemIndex) => (
                  <Card key={`${template.id}_${item.id}_${itemIndex}`}>
                    <CardContent className="stack-md">
                      <div
                        style={{
                          display: "grid",
                          gap: "0.55rem",
                          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))"
                        }}
                      >
                        <Label>
                          Item ID
                          <Input
                            value={item.id}
                            onChange={(event) =>
                              updateItem(template.id, itemIndex, (current) => ({
                                ...current,
                                id: event.target.value
                              }))
                            }
                          />
                        </Label>

                        <Label>
                          Type
                          <Select
                            value={item.type}
                            onChange={(event) =>
                              updateItem(template.id, itemIndex, (current) => ({
                                ...current,
                                type: event.target.value as SurveyItem["type"]
                              }))
                            }
                          >
                            <option value="likert">likert</option>
                            <option value="open_text">open_text</option>
                            <option value="multiple_choice">multiple_choice</option>
                          </Select>
                        </Label>

                        <Label>
                          Condition
                          <Select
                            value={item.condition}
                            onChange={(event) =>
                              updateItem(template.id, itemIndex, (current) => ({
                                ...current,
                                condition: event.target.value as SurveyItem["condition"]
                              }))
                            }
                          >
                            <option value="all">all</option>
                            <option value="drafter">drafter</option>
                            <option value="revisor">revisor</option>
                            <option value="facilitator">facilitator</option>
                          </Select>
                        </Label>

                        <Label>
                          Required
                          <Select
                            value={item.required ? "yes" : "no"}
                            onChange={(event) =>
                              updateItem(template.id, itemIndex, (current) => ({
                                ...current,
                                required: event.target.value === "yes"
                              }))
                            }
                          >
                            <option value="yes">yes</option>
                            <option value="no">no</option>
                          </Select>
                        </Label>
                      </div>

                      <Label>
                        Prompt
                        <Textarea
                          value={item.prompt}
                          onChange={(event) =>
                            updateItem(template.id, itemIndex, (current) => ({
                              ...current,
                              prompt: event.target.value
                            }))
                          }
                        />
                      </Label>

                      {item.type === "likert" ? (
                        <div
                          style={{
                            display: "grid",
                            gap: "0.55rem",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
                          }}
                        >
                          <Label>
                            Scale Min
                            <Input
                              type="number"
                              value={item.scaleMin ?? 1}
                              onChange={(event) =>
                                updateItem(template.id, itemIndex, (current) => ({
                                  ...current,
                                  scaleMin: Number(event.target.value)
                                }))
                              }
                            />
                          </Label>

                          <Label>
                            Scale Max
                            <Input
                              type="number"
                              value={item.scaleMax ?? 7}
                              onChange={(event) =>
                                updateItem(template.id, itemIndex, (current) => ({
                                  ...current,
                                  scaleMax: Number(event.target.value)
                                }))
                              }
                            />
                          </Label>
                        </div>
                      ) : null}

                      {item.type === "multiple_choice" ? (
                        <Label>
                          Options (comma separated)
                          <Input
                            value={(item.options ?? []).join(", ")}
                            onChange={(event) =>
                              updateItem(template.id, itemIndex, (current) => ({
                                ...current,
                                options: event.target.value
                                  .split(",")
                                  .map((option) => option.trim())
                                  .filter(Boolean)
                              }))
                            }
                          />
                        </Label>
                      ) : null}

                      <div>
                        <Button
                          variant="outline"
                          onClick={() =>
                            updateTemplate(template.id, (current) => ({
                              ...current,
                              items: current.items.filter((_unused, index) => index !== itemIndex)
                            }))
                          }
                        >
                          Remove Item
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="row-wrap">
                  <Button
                    variant="outline"
                    onClick={() =>
                      updateTemplate(template.id, (current) => ({
                        ...current,
                        items: [...current.items, blankItem(current.items.length)]
                      }))
                    }
                  >
                    Add Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="row-wrap">
            <Button disabled={savingTemplates || !templates} onClick={() => void saveTemplates()}>
              Save Survey Templates
            </Button>
            <Button variant="outline" onClick={() => void loadTemplates()}>
              Reload Templates
            </Button>
          </div>

          {message ? <p className="text-warning">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participant Preview</CardTitle>
          <CardDescription>
            Uses the same survey question renderer as the participant study flow.
          </CardDescription>
        </CardHeader>

        <CardContent className="stack-lg">
          <Card>
            <CardHeader>
              <CardTitle>{perConditionTemplate?.title ?? "Per-Condition Survey"}</CardTitle>
              <CardDescription>{perConditionTemplate?.intro ?? ""}</CardDescription>
            </CardHeader>

            <CardContent className="stack-md">
              <Label style={{ maxWidth: 280 }}>
                Preview Condition
                <Select
                  value={previewCondition}
                  onChange={(event) => setPreviewCondition(event.target.value as RoleCondition)}
                >
                  <option value="drafter">Drafter</option>
                  <option value="revisor">Revisor</option>
                  <option value="facilitator">Facilitator</option>
                </Select>
              </Label>

              <div className="stack-md">
                {previewPerConditionItems.map((item) => (
                  <SurveyQuestionField
                    key={`preview_per_${item.id}`}
                    item={item}
                    value={previewPerConditionAnswers[item.id]}
                    disabled={false}
                    onChange={(next) =>
                      setPreviewPerConditionAnswers((prev) => ({
                        ...prev,
                        [item.id]: next
                      }))
                    }
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{postStudyTemplate?.title ?? "Post-Study Survey"}</CardTitle>
              <CardDescription>{postStudyTemplate?.intro ?? ""}</CardDescription>
            </CardHeader>

            <CardContent className="stack-md">
              <div className="stack-md">
                {(postStudyTemplate?.items ?? []).map((item) => (
                  <SurveyQuestionField
                    key={`preview_post_${item.id}`}
                    item={item}
                    value={previewPostStudyAnswers[item.id]}
                    disabled={false}
                    onChange={(next) =>
                      setPreviewPostStudyAnswers((prev) => ({
                        ...prev,
                        [item.id]: next
                      }))
                    }
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
