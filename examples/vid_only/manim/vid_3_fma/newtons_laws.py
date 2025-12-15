from manim import *

class NewtonsLaws(Scene):
    def construct(self):
        # Start with F = ma in big letters in center
        fma_equation = MathTex(r"\mathbf{F = ma}", font_size=108, color=BLUE)
        fma_equation.move_to(ORIGIN)

        # Stroke in F = ma slower
        self.play(Write(fma_equation), run_time=2)
        self.wait(2)

        # Move F = ma to top and make smaller
        fma_small = MathTex(r"\mathbf{F = ma}", font_size=48, color=BLUE)
        fma_small.to_edge(UP)

        self.play(Transform(fma_equation, fma_small))
        self.wait(1)

        # Load and display Newton's image (we'll position it after laying out text)
        newton_image = ImageMobject("vid_3_fma/newton_public_domain.png")
        newton_image.height = config.frame_height * 0.7  # Smaller - 60% of screen height
        # Place roughly at center of right half horizontally
        right_half_center_x = config.frame_width * 0.35
        newton_image.set_x(right_half_center_x)
        # Vertically center Newton on the remaining space (align to left column center)
        newton_image.set_y(-fma_small.get_height())

        # Create title for Newton's Laws - under F=ma, aligned left
        title = Text("Isaac Newton's 3 Laws of Motion", font_size=32)
        title.next_to(fma_equation, DOWN, buff=1.2)
        title.to_edge(LEFT, buff=0.5)

        # Fade in both Newton image and title simultaneously
        self.play(FadeIn(newton_image), FadeIn(title))
        self.wait(1)

        # Create the three laws using Tex with auto-wrapping (set width to ~300px)
        law1 = Tex(
            r"\parbox{9.5cm}{1. An object at rest stays at rest, and an object in motion stays in motion with the same speed and in the same direction unless acted upon by an external force.}",
            font_size=32
        )

        law2 = Tex(
            r"\parbox{9.5cm}{2. The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass.}",
            font_size=32
        )

        law3 = Tex(
            r"\parbox{9.5cm}{3. Whenever one object exerts a force on another object, the second object exerts an equal and opposite on the first.}",
            font_size=32
        )

        # Stack laws under the title and keep them on the left
        laws_group = VGroup(law1, law2, law3).arrange(DOWN, aligned_edge=LEFT, buff=0.5)
        laws_group.next_to(title, DOWN, buff=0.5)
        laws_group.to_edge(LEFT, buff=0.5)

        # Fade in each law one by one quickly
        for law in [law1, law2, law3]:
            self.play(FadeIn(law), run_time=0.5)
            self.wait(0.8)

        self.wait(1)

        # Final pause to let everything be visible
        self.wait(5)