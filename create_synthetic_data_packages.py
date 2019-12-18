import quilt3

def move_nothing(lk, entry):
    return False

def create_pkg(size_str):
    pkg = quilt3.Package()
    pkg.set_dir(f"{size_str}/", f"s3://quilt-ml-data/data/download_benchmark/{size_str}/")
    pkg.push(f"download-benchmark/{size_str}", registry="s3://quilt-ml-data/", selector_fn=move_nothing)

def create_10kb_pkg():
    create_pkg("10kb")

def create_100kb_pkg():
    create_pkg("100kb")

def create_1mb_pkg():
    # In progress
    create_pkg("1mb")

def create_10mb_pkg():
    # Done
    create_pkg("10mb")

def create_100mb_pkg():
    # Done
    create_pkg("100mb")

def create_1gb_pkg():
    # In progress
    create_pkg("1gb")

def create_10gb_pkg():
    # Done!
    create_pkg("10gb")


if __name__ == '__main__':
    create_1gb_pkg()


