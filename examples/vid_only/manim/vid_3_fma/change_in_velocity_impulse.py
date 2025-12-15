from manim import *


class ChangeInVelocityImpulse(Scene):
    def construct(self):
        # Title
        title = Text(
            "Working with impulses",
            font_size=48,
        )
        title.to_edge(UP)

        # Plain-language formulas
        line1 = Text(
            "change in velocity = Force * time / mass",
            font_size=42,
        )
        or_just = Text(
            "or just:",
            font_size=28,
        )
        line2 = Text(
            "change in velocity = impulse / mass",
            font_size=42,
        )

        # Stack the plain text lines, centered under the title
        lines_group = VGroup(line1, or_just, line2).arrange(DOWN, buff=0.4)
        lines_group.next_to(title, DOWN, buff=0.8)
        lines_group.set_x(0)

        # Derivation steps from F = m a to the plain-language impulse formulas
        # Using Text for consistent font, with TransformMatchingShapes for smooth transitions.

        # Step 1: Force = mass * acceleration
        step1 = Text("Force = mass * acceleration", font_size=42)

        # Step 2: Force * time = mass * acceleration * time
        step2 = Text("Force * time = mass * acceleration * time", font_size=42)

        # Step 3: Force * time / mass = acceleration * time
        step3 = Text("Force * time / mass = acceleration * time", font_size=42)

        # Step 4: Force * time / mass = change in velocity
        step4 = Text("Force * time / mass = change in velocity", font_size=42)

        # Position first step centered under the title
        step1.next_to(title, DOWN, buff=0.8)
        step1.set_x(0)

        # Animate title, then the derivation, then transition to the summary lines
        self.play(FadeIn(title))
        self.wait(0.7)

        # Step 1
        self.play(FadeIn(step1))
        self.wait(0.7)

        # Step 2
        step2.move_to(step1)
        self.play(FadeOut(step1), FadeIn(step2))
        self.wait(0.7)

        # Step 3
        step3.move_to(step2)
        self.play(FadeOut(step2), FadeIn(step3))
        self.wait(0.7)

        # Step 4
        step4.move_to(step3)
        self.play(FadeOut(step3), FadeIn(step4))
        self.wait(0.7)

        # Clear the derivation and bring in the simple summary text
        self.play(FadeOut(step4), FadeIn(line1))
        #self.wait(0.3)

        #self.play(FadeIn(line1))
        self.wait(0.8)
        self.play(FadeIn(or_just))
        self.wait(0.4)
        self.play(FadeIn(line2))
        self.wait(1.2)

        # Subtitle above the formal math expression
        formal_title = Text(
            "As an equation:",
            font_size=36,
        )
        formal_title.next_to(lines_group, DOWN, buff=0.8)
        formal_title.set_x(0)

        # Transition to a concise math form with symbols
        math_form = MathTex(
            r"\Delta v = \frac{F\,\Delta t}{m} = \frac{J}{m}",
            font_size=64,
        )
        math_form.next_to(formal_title, DOWN, buff=0.5)
        math_form.set_x(0)

        # Keep the text visible; add the formal subtitle and math expression below
        self.play(FadeIn(formal_title))
        self.play(Write(math_form))
        self.wait(5)


