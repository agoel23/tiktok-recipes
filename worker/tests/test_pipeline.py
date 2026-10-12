from worker.pipeline import id_from_url
from worker.schema import Ingredient, measurements_source
from worker.sources import detect_source
from worker.sources.web import canonical_url


def ing(qty=1.0, estimated=False, scalable=True):
    return Ingredient(group=None, quantity=qty, unit="tsp", item="x", note=None,
                      scalable=scalable, estimated=estimated)


def test_detect_source():
    assert detect_source("https://www.tiktok.com/@chef/video/7301234567890") == "tiktok"
    assert detect_source("https://vm.tiktok.com/ZMabc123/") == "tiktok"
    assert detect_source("https://www.instagram.com/reel/C9xyz_AB/") == "instagram"
    assert detect_source("https://www.seriouseats.com/the-best-chili") == "web"
    assert detect_source("https://notiktok.com/x") == "web"


def test_id_from_url():
    assert id_from_url("https://www.tiktok.com/@chef/video/7301234567890?is_from_webapp=1", "tiktok") == "7301234567890"
    assert id_from_url("https://vm.tiktok.com/ZMabc123/", "tiktok") is None
    assert id_from_url("https://www.instagram.com/reel/C9xyz_AB/?igsh=abc", "instagram") == "C9xyz_AB"
    a = id_from_url("https://site.com/recipe/?utm_source=x#jump", "web")
    b = id_from_url("https://SITE.com/recipe", "web")
    assert a == b


def test_canonical_url():
    assert canonical_url("https://Www.Example.com/a/b/?utm=1#x") == "https://www.example.com/a/b"


def test_measurements_source():
    assert measurements_source([ing(), ing()]) == "explicit"
    assert measurements_source([ing(estimated=True), ing(estimated=True)]) == "estimated"
    assert measurements_source([ing(), ing(estimated=True)]) == "mixed"
    # "to taste" items don't count either way
    assert measurements_source([ing(), ing(qty=None, scalable=False, estimated=True)]) == "explicit"
