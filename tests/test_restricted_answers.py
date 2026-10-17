"""Offline regression checks; Box transport is replaced before agent import."""
import importlib
import os
import sys
import unittest
from types import ModuleType
from unittest.mock import patch

with patch.dict(sys.modules, {"shadow_box.tools": ModuleType("shadow_box.tools")}):
    answer = importlib.import_module("agents.answer")


class RestrictedAnswersTest(unittest.TestCase):
    def test_restricted_only_stops_before_retrieval_and_agent_loop(self):
        for question in ("What is the vendor pricing?", "Explain the gateway contract"):
            with self.subTest(question=question), \
                 patch.dict(os.environ, {"SHADOW_AGENTIC": "true"}), \
                 patch.object(answer, "_restricted_hit", return_value={"only": True}), \
                 patch.object(answer, "_people_cards", side_effect=RuntimeError("offline")), \
                 patch.object(answer, "_matched_items") as search, \
                 patch.object(answer, "_org_chart") as org, \
                 patch.object(answer, "log_activity"), \
                 patch("agents.common.strands_agent") as agent:
                result = answer.answer("alex", question)
                self.assertIn("Restricted folder", result["restricted_note"])
                self.assertEqual(result["citations"], [])
                self.assertIsNone(result["decision_status"])
                self.assertEqual(result["who_to_ask"]["name"], "Dana Kim")
                search.assert_not_called()
                org.assert_not_called()
                agent.assert_not_called()

    def test_shared_topic_without_readable_sources_also_finishes(self):
        with patch.object(answer, "_restricted_hit", return_value={"only": False}), \
             patch.object(answer, "_people_cards", return_value=[]), \
             patch.object(answer, "_matched_items", return_value=[]), \
             patch.object(answer, "log_activity"), \
             patch("agents.common.strands_agent") as agent, \
             patch.dict(os.environ, {"SHADOW_AGENTIC": "true"}):
            result = answer.answer("alex", "What is the checkout budget?")
            self.assertTrue(result["restricted_note"])
            self.assertEqual(result["citations"], [])
            agent.assert_not_called()

    def test_shared_topic_keeps_readable_answer_and_withheld_note(self):
        citation = {"file_id": "public", "name": "Checkout issue",
                    "source_type": "issue", "date": "2026-10-17",
                    "box_url": "https://app.box.com/file/public"}
        with patch.object(answer, "_restricted_hit", return_value={"only": False}), \
             patch.object(answer, "_people_cards", return_value=[]), \
             patch.object(answer, "_org_chart", return_value={}), \
             patch.object(answer, "_matched_items", return_value=[]), \
             patch.object(answer, "_build_citations", return_value=[citation]), \
             patch.object(answer, "_decisions", return_value=[]), \
             patch.object(answer, "_who_to_ask", return_value=None), \
             patch.object(answer.T, "can_read", return_value=True, create=True), \
             patch.object(answer.T, "ai_ask", return_value={"answer": "Public answer"}, create=True), \
             patch.object(answer, "_compose_markdown", return_value="Public answer"), \
             patch.object(answer, "log_activity"):
            result = answer._answer_pipeline("alex", "What is the checkout budget?")
            self.assertEqual(result["citations"], [citation])
            self.assertEqual(result["answer_markdown"], "Public answer")
            self.assertIn("One source", result["restricted_note"])


if __name__ == "__main__":
    unittest.main()
